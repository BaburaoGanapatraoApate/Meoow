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
  ALLOWED_MODELS
} from "../services/groqService";
import { resolveGroqCredential } from "../services/providerCredentialService";

const router = Router();

// All AI endpoints require authentication and valid device authorization
router.use(authMiddleware);
router.use(deviceAuthMiddleware);

// In-memory concurrency guard per user (instance-local)
const activeUserStreams = new Map<string, number>();
export const MAX_CONCURRENT_STREAMS_PER_USER = 2;

const chatPayloadSchema = z.object({
  requestId: z.string().max(100).optional(),
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
      jobTitle: z.string().max(200).optional(),
      job_title: z.string().max(200).optional(),
      company: z.string().max(200).optional(),
      experienceLevel: z.string().max(100).optional(),
      experience_level: z.string().max(100).optional(),
      interviewRound: z.string().max(100).optional(),
      interview_round: z.string().max(100).optional(),
      streamingModel: z.string().max(100).optional(),
      streaming_model: z.string().max(100).optional(),
      notes: z.string().max(2000).optional(),
      resumeText: z.string().max(10000).optional(),
      resume_text: z.string().max(10000).optional(),
      language: z.string().max(50).optional(),
      source: z.string().max(50).optional(),
    })
    .optional(),
  imageBase64: z.string().max(3500000).optional(), // Max ~2.6MB JPEG
  question: z.string().max(10000).optional(),
  source: z.string().max(50).optional(),
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

  try {
    // 1. Atomically check and reserve credit (or verify unlimited mode)
    reservation = await reserveCredit(userId, {
      description: "AI answer generated",
    });

    // 2. Set up SSE Streaming Headers
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

    // 3. Handle Client Disconnect before completion
    req.on("close", async () => {
      releaseConcurrencySlot();
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
    });

    // 4. Send Initial Start Event
    sendSSE({
      type: "start",
      requestId: reqId,
      source,
    });

    // 5. Resolve user-specific Groq API key (override or environment default)
    const groqApiKey = await resolveGroqCredential(userId);

    // 6. Execute Stream (Vision or Chat)
    let result: {
      fullAnswer: string;
      modelUsed: string;
      isError?: boolean;
      errorCode?: string;
      retryAfterSeconds?: number;
    };

    if (imageBase64) {
      result = await groqBackendService.streamScreenAnalysis(
        {
          imageBase64,
          question,
          model,
          apiKey: groqApiKey,
          sessionContext,
          signal: abortController.signal,
          requestId: reqId,
          activeStreamsCount: activeUserStreams.get(userId) || 1,
        },
        (chunkText) => {
          sendSSE({
            type: "chunk",
            text: chunkText,
            chunk: chunkText,
            content: chunkText,
            requestId: reqId,
          });
        }
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
          apiKey: groqApiKey,
          sessionContext,
          signal: abortController.signal,
        },
        (chunkText) => {
          sendSSE({
            type: "chunk",
            text: chunkText,
            chunk: chunkText,
            content: chunkText,
            requestId: reqId,
          });
        }
      );
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

    sendSSE({
      type: "done",
      requestId: reqId,
      answer: result.fullAnswer,
      timestamp: new Date().toISOString(),
      source,
      model: result.modelUsed,
      isError: result.isError,
      errorCode: result.errorCode,
      retryAfterSeconds: result.retryAfterSeconds,
    });

    releaseConcurrencySlot();
    res.end();
  } catch (err: any) {
    releaseConcurrencySlot();

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

