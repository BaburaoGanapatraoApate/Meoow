import { Router, Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { deviceAuthMiddleware } from "../middleware/deviceAuth";
import {
  reserveCredit,
  refundCredit,
  InsufficientCreditsError
} from "../services/creditService";
import {
  groqBackendService,
  ALLOWED_MODELS,
  ALLOWED_VISION_MODELS,
  DEFAULT_VISION_MODEL,
  isVisionSupported,
} from "../services/groqService";
import { resolveGroqCredential } from "../services/providerCredentialService";
import { getUserProviderOverride } from "../services/providerCredentialService";
import { providerKeyPool, getAuthoritativeUserRole } from "../services/providerKeyPool";
import {
  screenAnalysisCache,
  screenRequestCoalescer,
  computeBinaryImageFingerprint,
  computeServerContextSignature,
  computePromptHash,
  buildCompositeKey,
} from "../services/screenDeduplicationService";
import {
  chatAnalysisCache,
  chatRequestCoalescer,
  computeLogicalChatIdentity,
} from "../services/unnecessaryCallGuard";
import {
  screenFingerprintEngine,
  screenObservationStore,
} from "../services/screenFingerprintEngine";
import { requireMcqAssistantAdmin } from "../middleware/mcqAssistantAuth";
import { analyzeMcqScreenshot } from "../services/mcqAssistantService";

const router = Router();

// All AI endpoints require authentication and valid device authorization
router.use(authMiddleware);
router.use(deviceAuthMiddleware);

// In-memory concurrency guard per user (instance-local)
const activeUserStreams = new Map<string, number>();

const mcqAssistantPayloadSchema = z.object({
  imageBase64: z.string().min(100).max(18_000_000).optional(),
  mimeType: z.enum(["image/jpeg", "image/png"]).optional(),
  images: z.array(z.object({
    imageBase64: z.string().min(100).max(5_600_000),
    mimeType: z.enum(["image/jpeg", "image/png"]),
  })).optional(),
  config: z.object({
    category: z.string().trim().min(1).max(200),
    subject: z.string().trim().max(200).optional().default(""),
    difficulty: z.enum(["any", "easy", "medium", "hard"]),
    language: z.string().trim().min(1).max(50),
    instructions: z.string().trim().max(2000).optional().default(""),
  }),
}).refine(data => Boolean(data.images?.length || (data.imageBase64 && data.mimeType)), {
  message: "At least one screenshot is required.",
});

const activeMcqAssistantUsers = new Set<string>();

/** Admin-only, credit-free and stateless MCQ screenshot analysis. */
router.post(
  "/mcq-assistant/analyze",
  requireMcqAssistantAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const parsed = mcqAssistantPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "INVALID_MCQ_REQUEST",
        message: "Invalid MCQ screenshot or configuration.",
      });
      return;
    }

    const images = parsed.data.images?.length
      ? parsed.data.images
      : [{ imageBase64: parsed.data.imageBase64!, mimeType: parsed.data.mimeType! }];
    if (images.some(image => !/^[A-Za-z0-9+/]+={0,2}$/.test(image.imageBase64))) {
      res.status(400).json({ error: "INVALID_IMAGE", message: "Invalid screenshot data." });
      return;
    }

    const decodedBytes = images.reduce((total, image) => total + Math.floor((image.imageBase64.length * 3) / 4), 0);
    if (decodedBytes > 13_500_000) {
      res.status(413).json({
        error: "CAPTURE_COLLECTION_TOO_LARGE",
        message: "Capture collection is too large. Remove unnecessary captures or retake narrower screenshots.",
      });
      return;
    }

    if (activeMcqAssistantUsers.has(userId)) {
      res.status(429).json({
        error: "MCQ_ANALYSIS_IN_PROGRESS",
        message: "An MCQ screenshot is already being processed.",
      });
      return;
    }

    activeMcqAssistantUsers.add(userId);
    try {
      const result = await analyzeMcqScreenshot({ images, config: parsed.data.config });
      res.status(200).json({ answer: result.answer, model: result.model });
    } catch (err: any) {
      const status = [400, 413, 422, 503].includes(err?.status) ? err.status : 502;
      res.status(status).json({
        error: err?.code || "MCQ_ANALYSIS_FAILED",
        message: err?.message || "MCQ analysis failed. Please try again.",
      });
    } finally {
      activeMcqAssistantUsers.delete(userId);
    }
  }
);
export const MAX_CONCURRENT_STREAMS_PER_USER = 2;

// Anti-loop guard: guarantee each request can only be continued once
export const backendContinuedRequests = new Set<string>();

const chatPayloadSchema = z.object({
  requestId: z.string().max(100).optional(),
  isContinuation: z.boolean().optional(),
  parentRequestId: z.string().max(100).optional(),
  previousAnswer: z.string().max(50000).optional(),
  maxTokens: z.number().min(1).max(8192).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.union([z.string().max(20000), z.array(z.any()).max(10)]),
      })
    )
    .max(50)
    .optional()
    .default([]),
  model: z.string().max(100).optional(),
  sessionContext: z
    .object({
      sessionId: z.string().max(100).optional(),
      session_id: z.string().max(100).optional(),
      jobTitle: z.string().max(200).optional(),
      job_title: z.string().max(200).optional(),
      company: z.string().max(200).optional(),
      experienceLevel: z.string().max(50).optional(),
      experience_level: z.string().max(50).optional(),
      interviewRound: z.string().max(50).optional(),
      interview_round: z.string().max(50).optional(),
      streamingModel: z.string().max(100).optional(),
      streaming_model: z.string().max(100).optional(),
      visionModel: z.string().max(100).optional(),
      vision_model: z.string().max(100).optional(),
      notes: z.string().max(2000).optional(),
      resumeText: z.string().max(10000).optional(),
      resume_text: z.string().max(10000).optional(),
      language: z.string().max(50).optional(),
      source: z.string().max(50).optional(),
      taskType: z.string().max(100).optional(),
      parentTaskType: z.string().max(100).optional(),
      taskConfidence: z.number().optional(),
      taskTier: z.string().max(50).optional(),
      suggestedDepth: z.enum(["SHORT", "NORMAL", "DEEP"]).optional(),
      requiresCode: z.boolean().optional(),
      boundedContext: z.any().optional(),
      threadId: z.string().max(100).optional(),
      thread_id: z.string().max(100).optional(),
      captureSequence: z.number().int().nonnegative().optional(),
    })
    .optional(),
  imageBase64: z.string().max(3500000).optional(), // Max ~2.6MB JPEG
  question: z.string().max(10000).optional(),
  source: z.string().max(50).optional(),
  language: z.string().max(50).optional(),
  taskType: z.string().max(100).optional(),
  parentTaskType: z.string().max(100).optional(),
  taskConfidence: z.number().optional(),
  taskTier: z.string().max(50).optional(),
  suggestedDepth: z.enum(["SHORT", "NORMAL", "DEEP"]).optional(),
  requiresCode: z.boolean().optional(),
  boundedContext: z.any().optional(),
  threadId: z.string().max(100).optional(),
  captureSequence: z.number().int().nonnegative().optional(),
});

/**
 * POST /api/ai/groq/chat
 * Server-Sent Events (SSE) streaming chat completion with server-authoritative credit enforcement.
 */
router.post("/groq/chat", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = chatPayloadSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: "Request validation failed.",
      details: parsed.error.issues,
    });
    return;
  }

  // Check per-user active streaming concurrency
  const currentActive = activeUserStreams.get(userId) || 0;
  if (currentActive >= MAX_CONCURRENT_STREAMS_PER_USER) {
    res.status(429).json({
      error: "AI_CONCURRENCY_LIMIT",
      message: "Too many active AI generation requests. Please wait for the current request to finish.",
    });
    return;
  }

  // Increment active stream count
  activeUserStreams.set(userId, currentActive + 1);

  const {
    requestId,
    messages,
    model,
    sessionContext,
    imageBase64,
    question,
    source = sessionContext?.source || "audio",
  } = parsed.data;

  const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let isCompleted = false;
  let reservation: any = null;
  const abortController = new AbortController();

  let hasDecrementedSlot = false;
  const releaseConcurrencySlot = () => {
    if (!hasDecrementedSlot) {
      hasDecrementedSlot = true;
      const count = (activeUserStreams.get(userId) || 1) - 1;
      if (count <= 0) {
        activeUserStreams.delete(userId);
      } else {
        activeUserStreams.set(userId, count);
      }
    }
  };

  // 0. Authoritative Backend Vision Model Validation:
  // If image payload is present, the selected model MUST be vision-capable according to backend registry.
  // Frontend flags (isVisionModel, visionSupported, etc.) are ignored.
  const explicitVisionModel = model || sessionContext?.visionModel;
  if (imageBase64 && explicitVisionModel && !isVisionSupported(explicitVisionModel)) {
    releaseConcurrencySlot();
    res.status(400).json({
      error: "UNSUPPORTED_VISION_MODEL",
      message: `Model '${explicitVisionModel}' does not support vision or image analysis. Supported models: ${ALLOWED_VISION_MODELS.join(", ")}.`,
    });
    return;
  }

  // 1. Screen Deduplication & Coalescing (for screen requests that are NOT continuations)
  const isScreenRequest = !!imageBase64 && !parsed.data.isContinuation;
  let compositeKey = "";
  let inFlightLeaderEntry: any = null;
  let chatCompositeKey = "";
  let inFlightChatLeaderEntry: any = null;
  let changeEval: any = null;
  let screenLogicalIdentity = "";
  let screenPromptHash = "";

  if (isScreenRequest) {
    const { fingerprint } = computeBinaryImageFingerprint(imageBase64);
    const targetModel = model || sessionContext?.visionModel || DEFAULT_VISION_MODEL;
    const taskMetaForSig = {
      taskType: parsed.data.taskType || sessionContext?.taskType,
      parentTaskType: parsed.data.parentTaskType || sessionContext?.parentTaskType,
      boundedContext: parsed.data.boundedContext || sessionContext?.boundedContext,
    };
    const contextSig = computeServerContextSignature({
      boundedContext: taskMetaForSig.boundedContext,
      sessionContext,
      taskMetadata: taskMetaForSig,
    });
    const sessionId = sessionContext?.sessionId || sessionContext?.session_id || "default_session";
    const threadId = parsed.data.threadId || sessionContext?.threadId || sessionContext?.thread_id;

    // Canonical Authoritative Logical Request Identity (Task 9 machinery)
    const { compositeKey: sLogicalKey, promptHash } = computeLogicalChatIdentity({
      userId,
      sessionId,
      model: targetModel,
      taskType: taskMetaForSig.taskType,
      parentTaskType: taskMetaForSig.parentTaskType,
      question,
      suggestedDepth: parsed.data.suggestedDepth || sessionContext?.suggestedDepth,
      requiresCode: parsed.data.requiresCode !== undefined ? parsed.data.requiresCode : sessionContext?.requiresCode,
      language: parsed.data.language || sessionContext?.language,
      isContinuation: false,
      contextSig,
    });
    screenLogicalIdentity = sLogicalKey;
    screenPromptHash = promptHash;

    // --- Task 10: Screen Fingerprint / Semantic Material-Change Evaluation ---
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    const imgBuffer = Buffer.from(cleanBase64, "base64");
    const prevObs = screenObservationStore.getObservation(userId, sessionId);

    changeEval = screenFingerprintEngine.evaluateChange({
      currImageBuffer: imgBuffer,
      prevObservation: prevObs,
    });

    // Stage 4: Authoritative Logical Identity Decision:
    // Requires: unchanged screen + identical canonical logical identity (all 14 dimensions) + thread match + unexpired + answer present + NOT continuation
    const isThreadMatch = !threadId || !prevObs?.threadId || threadId === prevObs.threadId;
    const isIdentityMatch = prevObs?.logicalIdentityKey
      ? prevObs.logicalIdentityKey === screenLogicalIdentity
      : (prevObs?.contextSig === contextSig && (!prevObs?.modelUsed || prevObs.modelUsed === targetModel) && (!prevObs?.promptHash || prevObs.promptHash === promptHash));

    if (
      !changeEval.evaluation.isMaterialChange &&
      prevObs &&
      prevObs.priorAnswer &&
      !parsed.data.isContinuation &&
      Date.now() < prevObs.expiresAt &&
      isIdentityMatch &&
      isThreadMatch
    ) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const sendSSE = (data: any) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      sendSSE({
        type: "start",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        isContinuation: false,
        source: source || "screen",
      });

      sendSSE({
        type: "chunk",
        text: prevObs.priorAnswer,
        chunk: prevObs.priorAnswer,
        content: prevObs.priorAnswer,
        requestId: reqId,
      });

      sendSSE({
        type: "done",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        answer: prevObs.priorAnswer,
        timestamp: new Date().toISOString(),
        source: source || "screen",
        model: prevObs.modelUsed || targetModel,
        finishReason: "stop",
        isComplete: true,
        isError: false,
      });

      console.log(
        `[ScreenFingerprint] req=${reqId} reason=${changeEval.evaluation.reasonCode} -> REUSED prior answer via authoritative identity (0 credits, 0 calls)`
      );
      releaseConcurrencySlot();
      res.end();
      return;
    }

    compositeKey = buildCompositeKey({
      userId,
      sessionId,
      model: targetModel,
      contextSig,
      promptHash,
      fingerprint,
    });

    // Check Result Cache (TTL 60s)
    const cached = screenAnalysisCache.get(compositeKey);
    if (cached) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const sendSSE = (data: any) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      sendSSE({
        type: "start",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        isContinuation: false,
        source: source || "screen",
      });

      sendSSE({
        type: "chunk",
        text: cached.answer,
        chunk: cached.answer,
        content: cached.answer,
        requestId: reqId,
      });

      sendSSE({
        type: "done",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        answer: cached.answer,
        timestamp: new Date().toISOString(),
        source: source || "screen",
        model: cached.modelUsed,
        finishReason: cached.finishReason || "stop",
        isComplete: true,
        isError: false,
      });

      console.log(
        `[ScreenDedup] req=${reqId} cache=HIT model=${cached.modelUsed} chars=${cached.answer.length} fp=${fingerprint.slice(0, 10)}...`
      );

      if (changeEval?.currDecoded && changeEval?.currFp && changeEval?.currRowProfile) {
        const captureSeq =
          parsed.data.captureSequence ??
          sessionContext?.captureSequence ??
          Date.now();
        screenObservationStore
          .updateObservation({
            userId,
            sessionId,
            captureSequence: captureSeq,
            contextSig,
            threadId,
            exactSha256: changeEval.exactSha256,
            spatialFingerprint: changeEval.currFp.data,
            rowProfile: changeEval.currRowProfile,
            width: changeEval.currDecoded.width,
            height: changeEval.currDecoded.height,
            priorAnswer: cached.answer,
            modelUsed: cached.modelUsed,
            decodedLuminance: changeEval.currDecoded.luminance,
            logicalIdentityKey: screenLogicalIdentity,
            promptHash: screenPromptHash,
          })
          .catch((err) =>
            console.error("[ScreenFingerprint] Failed to update observation on cache hit:", err)
          );
      }

      releaseConcurrencySlot();
      res.end();
      return;
    }

    // Set up SSE Streaming Headers for live generation / coalescing
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendSSE = (data: any) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    // Synchronous atomic leader election BEFORE any await
    const election = screenRequestCoalescer.acquireLeaderOrFollower({
      compositeKey,
      userId,
      sessionId,
      model: targetModel,
      fingerprint,
      contextSig,
      promptHash,
      reqId,
      res,
      sendSSE,
    });

    if (!election.isLeader) {
      // Follower path: 0 credits, 0 provider calls, passive listener
      console.log(
        `[ScreenDedup] req=${reqId} coalesce=SUBSCRIBER leader=${election.inFlight.leaderId} fp=${fingerprint.slice(0, 10)}...`
      );
      req.on("close", () => {
        releaseConcurrencySlot();
        screenRequestCoalescer.handleSubscriberDisconnect(compositeKey, reqId);
      });
      return;
    }

    inFlightLeaderEntry = election.inFlight;
    console.log(
      `[ScreenDedup] req=${reqId} coalesce=LEADER fp=${fingerprint.slice(0, 10)}...`
    );
  } else if (!isScreenRequest && !parsed.data.isContinuation) {
    // 2. Non-Screen Chat Deduplication & Coalescing (Task 9)
    const targetModel = model || sessionContext?.streamingModel || "default";
    const taskMetaForSig = {
      taskType: parsed.data.taskType || sessionContext?.taskType,
      parentTaskType: parsed.data.parentTaskType || sessionContext?.parentTaskType,
      boundedContext: parsed.data.boundedContext || sessionContext?.boundedContext,
    };
    const contextSig = computeServerContextSignature({
      boundedContext: taskMetaForSig.boundedContext,
      sessionContext,
      taskMetadata: taskMetaForSig,
    });
    const sessionId = sessionContext?.sessionId || sessionContext?.session_id || "default_session";

    const { compositeKey: cKey, promptHash } = computeLogicalChatIdentity({
      userId,
      sessionId,
      model: targetModel,
      taskType: parsed.data.taskType || sessionContext?.taskType,
      parentTaskType: parsed.data.parentTaskType || sessionContext?.parentTaskType,
      question,
      suggestedDepth: parsed.data.suggestedDepth || sessionContext?.suggestedDepth,
      requiresCode: parsed.data.requiresCode ?? sessionContext?.requiresCode,
      language: sessionContext?.language,
      isContinuation: false,
      contextSig,
    });
    chatCompositeKey = cKey;

    // Check Result Cache (TTL 60s)
    const cached = chatAnalysisCache.get(chatCompositeKey);
    if (cached) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const sendSSE = (data: any) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      sendSSE({
        type: "start",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        isContinuation: false,
        source: source || "manual",
      });

      sendSSE({
        type: "chunk",
        text: cached.answer,
        chunk: cached.answer,
        content: cached.answer,
        requestId: reqId,
      });

      sendSSE({
        type: "done",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        answer: cached.answer,
        timestamp: new Date().toISOString(),
        source: source || "manual",
        model: cached.modelUsed,
        finishReason: cached.finishReason || "stop",
        isComplete: true,
        isError: false,
      });

      console.log(
        `[ChatDedup] req=${reqId} cache=HIT model=${cached.modelUsed} chars=${cached.answer.length} task=${cached.taskType}`
      );
      releaseConcurrencySlot();
      res.end();
      return;
    }

    // Set up SSE Streaming Headers for live generation / coalescing
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendSSE = (data: any) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    // Synchronous atomic leader election BEFORE any await (Mandatory Correction 1)
    const election = chatRequestCoalescer.acquireLeaderOrFollower({
      compositeKey: chatCompositeKey,
      userId,
      sessionId,
      model: targetModel,
      contextSig,
      promptHash,
      taskType: parsed.data.taskType || sessionContext?.taskType,
      reqId,
      res,
      sendSSE,
    });

    if (!election.isLeader) {
      // Follower path: 0 credits, 0 provider calls, passive listener
      console.log(
        `[ChatDedup] req=${reqId} coalesce=SUBSCRIBER leader=${election.inFlight.leaderId}`
      );
      req.on("close", () => {
        releaseConcurrencySlot();
        chatRequestCoalescer.handleSubscriberDisconnect(chatCompositeKey, reqId);
      });
      return;
    }

    inFlightChatLeaderEntry = election.inFlight;
    console.log(
      `[ChatDedup] req=${reqId} coalesce=LEADER`
    );
  }

  try {
    // 1. Atomically check and reserve credit (or verify unlimited mode)
    // Continuation requests do NOT consume an additional credit.
    if (!parsed.data.isContinuation) {
      reservation = await reserveCredit(userId, {
        description: "AI answer generated",
      });
    } else {
      if (!parsed.data.parentRequestId) {
        releaseConcurrencySlot();
        res.status(400).json({
          error: "INVALID_CONTINUATION",
          message: "parentRequestId is required for continuation.",
        });
        return;
      }
      if (backendContinuedRequests.has(parsed.data.parentRequestId)) {
        releaseConcurrencySlot();
        res.status(400).json({
          error: "ALREADY_CONTINUED",
          message: "A continuation has already been executed for this request.",
        });
        return;
      }
      backendContinuedRequests.add(parsed.data.parentRequestId);
      reservation = null;
    }

    // 2. Set up SSE Streaming Headers (if not already sent by screen request leader)
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
    }

    const sendSSE = (data: any) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    // 3. Handle Client Disconnect before completion
    req.on("close", async () => {
      releaseConcurrencySlot();
      if (inFlightLeaderEntry) {
        const { allDisconnected } = screenRequestCoalescer.handleSubscriberDisconnect(compositeKey, reqId);
        if (allDisconnected && !isCompleted) {
          abortController.abort();
          if (reservation?.transactionId) {
            try {
              await refundCredit(userId, reservation.transactionId, "Client disconnected");
            } catch (refundErr) {
              console.error("[GroqRouter] Failed to refund on disconnect:", refundErr);
            }
          }
        }
      } else if (inFlightChatLeaderEntry) {
        const { allDisconnected } = chatRequestCoalescer.handleSubscriberDisconnect(chatCompositeKey, reqId);
        if (allDisconnected && !isCompleted) {
          abortController.abort();
          if (reservation?.transactionId) {
            try {
              await refundCredit(userId, reservation.transactionId, "Client disconnected");
            } catch (refundErr) {
              console.error("[GroqRouter] Failed to refund on disconnect:", refundErr);
            }
          }
        }
      } else {
        if (!isCompleted) {
          abortController.abort();
          if (reservation?.transactionId) {
            try {
              await refundCredit(userId, reservation.transactionId, "Client disconnected");
            } catch (refundErr) {
              console.error("[GroqRouter] Failed to refund on disconnect:", refundErr);
            }
          }
        }
      }
    });

    // 4. Send Initial Start Event
    if (inFlightLeaderEntry) {
      screenRequestCoalescer.broadcastStart(inFlightLeaderEntry, {
        type: "start",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        isContinuation: false,
        source,
      });
    } else if (inFlightChatLeaderEntry) {
      chatRequestCoalescer.broadcastStart(inFlightChatLeaderEntry, {
        type: "start",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        isContinuation: false,
        source,
      });
    } else {
      sendSSE({
        type: "start",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        isContinuation: parsed.data.isContinuation || false,
        source,
      });
    }

    // 5. Resolve Groq credential: user override (BYOK) or managed ProviderKeyPool
    const dbOverrideKey = await getUserProviderOverride(userId, "groq");
    const userRole = await getAuthoritativeUserRole(userId);

    const attemptedCredentialIds = new Set<string>();
    const eligibleCount = providerKeyPool.getEligibleCount({ provider: "groq", role: userRole });
    const maxAttempts = dbOverrideKey ? 1 : Math.min(5, eligibleCount || 1);

    let result: {
      fullAnswer: string;
      modelUsed: string;
      finishReason?: string;
      isComplete?: boolean;
      isError?: boolean;
      errorCode?: string;
      retryAfterSeconds?: number;
      outputBudget?: any;
    } | null = null;

    let chunksDispatched = 0;
    let lastError: any = null;

    const taskMetadata = {
      taskType: parsed.data.taskType || sessionContext?.taskType,
      parentTaskType: parsed.data.parentTaskType || sessionContext?.parentTaskType,
      confidence: parsed.data.taskConfidence ?? sessionContext?.taskConfidence,
      tier: parsed.data.taskTier || sessionContext?.taskTier,
      suggestedDepth: parsed.data.suggestedDepth || sessionContext?.suggestedDepth,
      requiresCode: parsed.data.requiresCode ?? sessionContext?.requiresCode,
      boundedContext: parsed.data.boundedContext || sessionContext?.boundedContext,
    };

    while (attemptedCredentialIds.size < maxAttempts && !result) {
      let currentKey: string | undefined = dbOverrideKey || undefined;
      let lease: any = null;

      if (!dbOverrideKey) {
        lease = providerKeyPool.acquireCredential({
          provider: "groq",
          role: userRole,
          excludeIds: attemptedCredentialIds,
        });

        if (!lease) {
          break;
        }

        currentKey = lease.apiKey;
        attemptedCredentialIds.add(lease.credentialId);
      } else {
        attemptedCredentialIds.add("user-override");
      }

      const chunkEmitter = (chunkText: string) => {
        chunksDispatched++;
        if (inFlightLeaderEntry) {
          screenRequestCoalescer.broadcastChunk(inFlightLeaderEntry, chunkText);
        } else if (inFlightChatLeaderEntry) {
          chatRequestCoalescer.broadcastChunk(inFlightChatLeaderEntry, chunkText);
        } else {
          sendSSE({
            type: "chunk",
            text: chunkText,
            chunk: chunkText,
            content: chunkText,
            requestId: reqId,
          });
        }
      };

      try {
        if (imageBase64) {
          result = await groqBackendService.streamScreenAnalysis(
            {
              imageBase64,
              question,
              model,
              apiKey: currentKey,
              sessionContext,
              taskMetadata,
              signal: abortController.signal,
              requestId: reqId,
              activeStreamsCount: activeUserStreams.get(userId) || 1,
              maxTokens: parsed.data.maxTokens,
            },
            chunkEmitter
          );
        } else {
          if (messages.length === 0 && !question) {
            throw new Error("At least one message or question is required.");
          }

          const effectiveMessages =
            messages.length > 0
              ? messages
              : [{ role: "user" as const, content: question || "" }];

          result = await groqBackendService.streamChat(
            {
              messages: effectiveMessages,
              model,
              apiKey: currentKey,
              sessionContext,
              taskMetadata,
              signal: abortController.signal,
              requestId: reqId,
              maxTokens: parsed.data.maxTokens,
              isContinuation: parsed.data.isContinuation,
              previousAnswer: parsed.data.previousAnswer,
            },
            chunkEmitter
          );
        }

        if (result.isError && chunksDispatched === 0) {
          if (lease) {
            providerKeyPool.recordError(lease.credentialId, {
              status: result.errorCode === "RATE_LIMIT_EXCEEDED" ? 429 : 500,
              message: result.fullAnswer,
            });
            lease.release();
          }
          result = null;
          continue;
        }

        if (lease) {
          providerKeyPool.recordSuccess(lease.credentialId, result.modelUsed);
          lease.release();
        }
      } catch (err: any) {
        lastError = err;
        if (lease) {
          providerKeyPool.recordError(lease.credentialId, err);
          lease.release();
        }

        const is400 = err.status === 400 || err.statusCode === 400;
        const is413 = err.status === 413 || err.statusCode === 413;
        const isAbort = abortController.signal?.aborted || err.name === "AbortError";

        if (chunksDispatched > 0 || isAbort || is400 || is413) {
          throw err;
        }
      }
    }

    if (!result) {
      throw lastError || new Error("All eligible AI provider credentials temporarily exhausted or unavailable.");
    }

    // 6. Finalize Credit Consumption & Send Done Event
    isCompleted = true;
    if (result.isError && reservation?.transactionId) {
      try {
        await refundCredit(userId, reservation.transactionId, result.fullAnswer);
      } catch (refundErr) {
        console.error("[GroqRouter] Failed to refund credit on error notice:", refundErr);
      }
    }

    if (inFlightLeaderEntry) {
      if (result.finishReason === "stop" && result.isComplete && !result.isError && result.fullAnswer) {
        screenAnalysisCache.set({
          compositeKey,
          userId,
          sessionId: sessionContext?.sessionId || sessionContext?.session_id || "default_session",
          modelUsed: result.modelUsed,
          answer: result.fullAnswer,
          finishReason: result.finishReason,
          isComplete: result.isComplete,
          isError: result.isError,
          fingerprint: inFlightLeaderEntry.fingerprint,
          contextSig: inFlightLeaderEntry.contextSig,
          promptHash: inFlightLeaderEntry.promptHash,
        });

        if (changeEval?.currDecoded && changeEval?.currFp && changeEval?.currRowProfile) {
          const captureSeq =
            parsed.data.captureSequence ??
            sessionContext?.captureSequence ??
            Date.now();
          screenObservationStore
            .updateObservation({
              userId,
              sessionId: sessionContext?.sessionId || sessionContext?.session_id || "default_session",
              captureSequence: captureSeq,
              contextSig: inFlightLeaderEntry.contextSig,
              threadId: sessionContext?.threadId || sessionContext?.thread_id,
              exactSha256: changeEval.exactSha256,
              spatialFingerprint: changeEval.currFp.data,
              rowProfile: changeEval.currRowProfile,
              width: changeEval.currDecoded.width,
              height: changeEval.currDecoded.height,
              priorAnswer: result.fullAnswer,
              modelUsed: result.modelUsed,
              decodedLuminance: changeEval.currDecoded.luminance,
              logicalIdentityKey: screenLogicalIdentity,
              promptHash: screenPromptHash,
            })
            .catch((err) =>
              console.error("[ScreenFingerprint] Failed to update observation on leader finish:", err)
            );
        }
      }

      screenRequestCoalescer.broadcastDone(inFlightLeaderEntry, {
        type: "done",
        parentRequestId: parsed.data.parentRequestId,
        answer: result.fullAnswer,
        timestamp: new Date().toISOString(),
        source,
        model: result.modelUsed,
        finishReason: result.finishReason || (result.isError ? "error" : "stop"),
        isComplete: result.isComplete ?? (result.finishReason === "stop"),
        isError: result.isError,
        errorCode: result.errorCode,
        retryAfterSeconds: result.retryAfterSeconds,
        qualityGate: (result as any).qualityGate,
        outputBudget: (result as any).outputBudget,
      });
    } else if (inFlightChatLeaderEntry) {
      if (result.finishReason === "stop" && result.isComplete && !result.isError && result.fullAnswer) {
        chatAnalysisCache.set({
          compositeKey: chatCompositeKey,
          userId,
          sessionId: sessionContext?.sessionId || sessionContext?.session_id || "default_session",
          modelUsed: result.modelUsed,
          answer: result.fullAnswer,
          taskType: parsed.data.taskType || sessionContext?.taskType,
          finishReason: result.finishReason,
          isComplete: result.isComplete,
          isError: result.isError,
          contextSig: inFlightChatLeaderEntry.contextSig,
          promptHash: inFlightChatLeaderEntry.promptHash,
        });
      }

      chatRequestCoalescer.broadcastDone(inFlightChatLeaderEntry, {
        type: "done",
        parentRequestId: parsed.data.parentRequestId,
        answer: result.fullAnswer,
        timestamp: new Date().toISOString(),
        source,
        model: result.modelUsed,
        finishReason: result.finishReason || (result.isError ? "error" : "stop"),
        isComplete: result.isComplete ?? (result.finishReason === "stop"),
        isError: result.isError,
        errorCode: result.errorCode,
        retryAfterSeconds: result.retryAfterSeconds,
        qualityGate: (result as any).qualityGate,
        outputBudget: (result as any).outputBudget,
      });
    } else {
      sendSSE({
        type: "done",
        requestId: reqId,
        parentRequestId: parsed.data.parentRequestId,
        answer: result.fullAnswer,
        timestamp: new Date().toISOString(),
        source,
        model: result.modelUsed,
        finishReason: result.finishReason || (result.isError ? "error" : "stop"),
        isComplete: result.isComplete ?? (result.finishReason === "stop"),
        isError: result.isError,
        errorCode: result.errorCode,
        retryAfterSeconds: result.retryAfterSeconds,
        qualityGate: (result as any).qualityGate,
        outputBudget: (result as any).outputBudget,
      });
      res.end();
    }

    releaseConcurrencySlot();
  } catch (err: any) {
    releaseConcurrencySlot();

    if (inFlightLeaderEntry) {
      screenRequestCoalescer.broadcastError(inFlightLeaderEntry, {
        message: "AI generation failed. Please try again.",
        code: "AI_PROVIDER_ERROR",
      });
    } else if (inFlightChatLeaderEntry) {
      chatRequestCoalescer.broadcastError(inFlightChatLeaderEntry, {
        message: "AI generation failed. Please try again.",
        code: "AI_PROVIDER_ERROR",
      });
    }

    // 7. Handle Failures & Refund Reserved Credits
    if (!isCompleted && reservation?.transactionId) {
      try {
        await refundCredit(userId, reservation.transactionId, err.message || "Generation failed");
      } catch (refundErr) {
        console.error("[GroqRouter] Failed to refund on error:", refundErr);
      }
    }

    if (err instanceof InsufficientCreditsError || err.status === 402) {
      res.status(402).json({
        error: "INSUFFICIENT_CREDITS",
        message: "You do not have enough credits.",
      });
      return;
    }

    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            requestId: reqId,
            error: "AI generation failed. Please try again.",
            code: "AI_PROVIDER_ERROR",
          })}\n\n`
        );
        res.end();
      }
    } else {
      const status = err.status || 500;
      res.status(status).json({
        error: "AI_PROVIDER_ERROR",
        message: "AI generation failed. Please try again.",
      });
    }
  }
});

export default router;

