import Groq from "groq-sdk";
import dotenv from "dotenv";
import { verifyAnswerQuality, QualityCheckResult } from "./qualityGate";
import { ThinkingStreamFilter } from "./thinkingStreamFilter";
import { extractRelevantResumeContext } from "./screenDeduplicationService";
import {
  buildCompressedSystemPrompt,
  getModularTaskStrategy,
  buildScreenAnalysisPrompt,
  formatBoundedContextCompact,
} from "./promptCompressionEngine";
import {
  resolveOutputBudget,
  OutputBudgetResult,
} from "./outputBudgetEngine";

dotenv.config();

export type ReasoningOutputMode = "hidden" | "raw" | "parsed" | "none";
export type ModelStatus = "active" | "preview" | "fallback" | "supported" | "deprecated";
export type ModelModality = "text" | "multimodal";
export type ModelPurpose = "chat" | "vision" | "chat_and_vision";

export interface ModelMetadata {
  id: string;
  displayName: string;
  visionSupported: boolean;
  textSupported: boolean;
  reasoningSupported: boolean;
  reasoningOutputMode: ReasoningOutputMode;
  modality: ModelModality;
  purpose: ModelPurpose;
  status: ModelStatus;
  /**
   * Application-level request output token cap for Meoow generation (not provider hardware ceiling).
   * Dictates request budget for responsive, real-time interview co-pilot answers:
   * - Qwen 3.8 vision: 1024 tokens
   * - Text models: 1024 tokens
   */
  maxOutputTokens: number;
  /** Explicit alias clarifying that this is Meoow's application request budget */
  appMaxTokens?: number;
}

export const MODEL_REGISTRY: Record<string, ModelMetadata> = {
  "qwen/qwen3.8-27b": {
    id: "qwen/qwen3.8-27b",
    displayName: "Qwen 3.8 27B",
    visionSupported: true,
    textSupported: true,
    reasoningSupported: true,
    reasoningOutputMode: "hidden",
    modality: "multimodal",
    purpose: "chat_and_vision",
    status: "preview", // Groq Preview status
    maxOutputTokens: 1024,
  },
  "openai/gpt-oss-120b": {
    id: "openai/gpt-oss-120b",
    displayName: "GPT OSS 120B",
    visionSupported: false,
    textSupported: true,
    reasoningSupported: false,
    reasoningOutputMode: "none",
    modality: "text",
    purpose: "chat",
    status: "fallback",
    maxOutputTokens: 1024,
  },
  "openai/gpt-oss-20b": {
    id: "openai/gpt-oss-20b",
    displayName: "GPT OSS 20B",
    visionSupported: false,
    textSupported: true,
    reasoningSupported: false,
    reasoningOutputMode: "none",
    modality: "text",
    purpose: "chat",
    status: "supported",
    maxOutputTokens: 1024,
  },
  "groq/compound-mini": {
    id: "groq/compound-mini",
    displayName: "Compound Mini",
    visionSupported: false,
    textSupported: true,
    reasoningSupported: false,
    reasoningOutputMode: "none",
    modality: "text",
    purpose: "chat",
    status: "supported",
    maxOutputTokens: 1024,
  },
  "groq/compound": {
    id: "groq/compound",
    displayName: "Compound",
    visionSupported: false,
    textSupported: true,
    reasoningSupported: false,
    reasoningOutputMode: "none",
    modality: "text",
    purpose: "chat",
    status: "supported",
    maxOutputTokens: 1024,
  },
};

export const ALLOWED_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "groq/compound-mini",
  "groq/compound"
];

export const DEFAULT_MODEL = "qwen/qwen3.8-27b";
export const FALLBACK_MODEL = "openai/gpt-oss-120b";

export const DEFAULT_VISION_MODEL = "qwen/qwen3.8-27b";
export const FALLBACK_VISION_MODEL = "qwen/qwen3.8-27b";
export const ALLOWED_VISION_MODELS = [
  "qwen/qwen3.8-27b",
];

export function isVisionSupported(modelId: string): boolean {
  if (!modelId) return false;
  const meta = MODEL_REGISTRY[modelId];
  return meta ? meta.visionSupported : false;
}

export function isReasoningSupported(modelId: string): boolean {
  if (!modelId) return false;
  const meta = MODEL_REGISTRY[modelId];
  return meta ? meta.reasoningSupported : false;
}

export function getReasoningFormatForModel(modelId: string): "hidden" | "raw" | "parsed" | undefined {
  const meta = MODEL_REGISTRY[modelId];
  if (meta?.reasoningSupported && meta.reasoningOutputMode === "hidden") {
    return "hidden";
  }
  return undefined;
}

export interface TaskMetadata {
  taskType?: string;
  parentTaskType?: string;
  confidence?: number;
  tier?: string;
  rationale?: string;
  suggestedDepth?: 'SHORT' | 'NORMAL' | 'DEEP';
  requiresCode?: boolean;
  boundedContext?: any;
}

export interface SessionContextData {
  sessionId?: string;
  jobTitle?: string;
  job_title?: string;
  company?: string;
  experienceLevel?: string;
  experience_level?: string;
  interviewRound?: string;
  interview_round?: string;
  streamingModel?: string;
  streaming_model?: string;
  visionModel?: string;
  vision_model?: string;
  notes?: string;
  resumeText?: string;
  resume_text?: string;
  language?: string;
  source?: string;
  taskType?: string;
  parentTaskType?: string;
  taskConfidence?: number;
  taskTier?: string;
  suggestedDepth?: 'SHORT' | 'NORMAL' | 'DEEP';
  requiresCode?: boolean;
  boundedContext?: any;
  taskMetadata?: TaskMetadata;
}

export interface ChatStreamOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: any }>;
  model?: string;
  apiKey?: string;
  sessionContext?: SessionContextData;
  taskMetadata?: TaskMetadata;
  signal?: AbortSignal;
  onChunk?: (chunkText: string) => void;
  requestId?: string;
  maxTokens?: number;
  isContinuation?: boolean;
  previousAnswer?: string;
}

export interface ChatStreamResult {
  fullAnswer: string;
  modelUsed: string;
  finishReason: "stop" | "length" | "abort" | "error" | "unknown";
  isComplete: boolean;
  chunkCount: number;
  durationMs: number;
  qualityGate?: QualityCheckResult;
  outputBudget?: OutputBudgetResult;
}

export interface ScreenAnalysisOptions {
  imageBase64: string;
  question?: string;
  model?: string;
  apiKey?: string;
  sessionContext?: SessionContextData;
  taskMetadata?: TaskMetadata;
  signal?: AbortSignal;
  onChunk?: (chunkText: string) => void;
  requestId?: string;
  activeStreamsCount?: number;
  maxTokens?: number;
}

export interface ScreenAnalysisResult {
  fullAnswer: string;
  modelUsed: string;
  finishReason?: "stop" | "length" | "abort" | "error" | "unknown" | string;
  isComplete?: boolean;
  isError?: boolean;
  errorCode?: string;
  retryAfterSeconds?: number;
  chunkCount?: number;
  durationMs?: number;
  outputBudget?: OutputBudgetResult;
}
export const MAX_SAFE_COOLDOWN_SECONDS = 86400; // 24-hour upper sanity limit against corrupt headers
export const DEFAULT_SAFE_COOLDOWN_SECONDS = 20;

export interface RetryExtractionResult {
  seconds: number;
  source: "retry-after" | "x-ratelimit-reset-tokens" | "x-ratelimit-reset-requests" | "error-message" | "fallback-default";
  rawValue: string | null;
}

/**
 * Robust duration parser for rate-limit reset strings.
 * Supports: pure seconds ("19"), milliseconds ("134ms"), and composite strings ("7.66s", "1m 12.5s", "1h 45m 7.2s").
 */
export function parseDurationString(str: string): number | null {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim().toLowerCase();
  if (!trimmed) return null;

  // 1. Pure positive number in seconds (e.g. "19", "19.5")
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    return isFinite(n) && n > 0 ? n : null;
  }

  // 2. Pure milliseconds (e.g. "134ms", "500ms")
  const msMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*ms$/);
  if (msMatch) {
    const ms = parseFloat(msMatch[1]);
    return isFinite(ms) && ms > 0 ? ms / 1000 : null;
  }

  // 3. Composite or unit-suffixed duration: hours, minutes, seconds, milliseconds
  const compRegex = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?!s))?\s*(?:(\d+(?:\.\d+)?)\s*s)?\s*(?:(\d+(?:\.\d+)?)\s*ms)?$/;
  const match = trimmed.match(compRegex);
  if (match && (match[1] !== undefined || match[2] !== undefined || match[3] !== undefined || match[4] !== undefined)) {
    const h = match[1] ? parseFloat(match[1]) : 0;
    const m = match[2] ? parseFloat(match[2]) : 0;
    const s = match[3] ? parseFloat(match[3]) : 0;
    const ms = match[4] ? parseFloat(match[4]) : 0;

    if ([h, m, s, ms].some((v) => !isFinite(v) || v < 0)) return null;
    const totalSeconds = h * 3600 + m * 60 + s + ms / 1000;
    return totalSeconds > 0 ? totalSeconds : null;
  }

  return null;
}

/**
 * Extract retry cooldown in seconds with precedence:
 * 1. retry-after header (seconds)
 * 2. x-ratelimit-reset-tokens header (duration)
 * 3. x-ratelimit-reset-requests header (duration)
 * 4. Error message "try again in <duration>"
 * 5. Safe bounded default fallback (20s)
 */
export function extractRetrySeconds(err: any, requestId?: string): RetryExtractionResult {
  try {
    const headers = err?.headers || err?.response?.headers;

    const getHeader = (name: string): string | undefined => {
      if (!headers) return undefined;
      if (typeof headers.get === "function") {
        const val = headers.get(name);
        if (val !== null && val !== undefined) return String(val);
      }
      const lower = name.toLowerCase();
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === lower) {
          const val = headers[k];
          if (val !== null && val !== undefined) return String(val);
        }
      }
      return undefined;
    };

    // 1. Prefer server-provided retry-after on actual 429
    const rawRetryAfter = getHeader("retry-after");
    if (rawRetryAfter) {
      const parsed = parseDurationString(rawRetryAfter);
      if (parsed !== null && parsed > 0) {
        const rounded = Math.ceil(parsed);
        const capped = Math.min(MAX_SAFE_COOLDOWN_SECONDS, Math.max(1, rounded));
        console.log(
          `[RateLimitCooldown] req=${requestId || "unknown"} source=retry-after raw="${rawRetryAfter}" parsed=${parsed}s capped=${capped}s`
        );
        return { seconds: capped, source: "retry-after", rawValue: rawRetryAfter };
      }
    }

    // 2. Parse x-ratelimit-reset-tokens duration
    const rawResetTokens = getHeader("x-ratelimit-reset-tokens");
    if (rawResetTokens) {
      const parsed = parseDurationString(rawResetTokens);
      if (parsed !== null && parsed > 0) {
        const rounded = Math.ceil(parsed);
        const capped = Math.min(MAX_SAFE_COOLDOWN_SECONDS, Math.max(1, rounded));
        console.log(
          `[RateLimitCooldown] req=${requestId || "unknown"} source=x-ratelimit-reset-tokens raw="${rawResetTokens}" parsed=${parsed}s capped=${capped}s`
        );
        return { seconds: capped, source: "x-ratelimit-reset-tokens", rawValue: rawResetTokens };
      }
    }

    // 3. Parse x-ratelimit-reset-requests duration
    const rawResetRequests = getHeader("x-ratelimit-reset-requests");
    if (rawResetRequests) {
      const parsed = parseDurationString(rawResetRequests);
      if (parsed !== null && parsed > 0) {
        const rounded = Math.ceil(parsed);
        const capped = Math.min(MAX_SAFE_COOLDOWN_SECONDS, Math.max(1, rounded));
        console.log(
          `[RateLimitCooldown] req=${requestId || "unknown"} source=x-ratelimit-reset-requests raw="${rawResetRequests}" parsed=${parsed}s capped=${capped}s`
        );
        return { seconds: capped, source: "x-ratelimit-reset-requests", rawValue: rawResetRequests };
      }
    }

    // 4. Parse explicit "try again in <duration>" from error message with validation
    const msg = err?.message || err?.error?.message || "";
    const tryAgainMatch = msg.match(/try again in\s+([0-9a-z\s\.]+?)(?:\.\s|\.$|\s+need|\s+please|$)/i);
    if (tryAgainMatch && tryAgainMatch[1]) {
      const rawMsgDuration = tryAgainMatch[1].trim();
      const parsed = parseDurationString(rawMsgDuration);
      if (parsed !== null && parsed > 0) {
        const rounded = Math.ceil(parsed);
        const capped = Math.min(MAX_SAFE_COOLDOWN_SECONDS, Math.max(1, rounded));
        console.log(
          `[RateLimitCooldown] req=${requestId || "unknown"} source=error-message raw="${rawMsgDuration}" parsed=${parsed}s capped=${capped}s`
        );
        return { seconds: capped, source: "error-message", rawValue: rawMsgDuration };
      }
    }
  } catch (err: any) {
    console.warn(`[RateLimitCooldown] Failed to extract retry cooldown: ${err?.message}`);
  }

  // Safe bounded fallback
  console.log(
    `[RateLimitCooldown] req=${requestId || "unknown"} source=fallback-default raw=null parsed=${DEFAULT_SAFE_COOLDOWN_SECONDS}s capped=${DEFAULT_SAFE_COOLDOWN_SECONDS}s`
  );
  return { seconds: DEFAULT_SAFE_COOLDOWN_SECONDS, source: "fallback-default", rawValue: null };
}

/**
 * Return specific interview answer strategy instructions for a given task type.
 * Delegated to canonical PromptCompressionEngine for Task 7.
 */
export function getTaskStrategyInstructions(
  taskType?: string,
  parentTaskType?: string,
  requiresCode?: boolean,
  options?: {
    hasCandidateExperience?: boolean;
    hasCompanyContext?: boolean;
  }
): string {
  return getModularTaskStrategy(taskType, parentTaskType, requiresCode, options);
}

/**
 * Format bounded context snapshot into compact structured prompt text.
 * Delegated to canonical PromptCompressionEngine for Task 7.
 */
export function formatBoundedContextForPrompt(boundedContext?: any): string {
  return formatBoundedContextCompact(boundedContext);
}

export class GroqBackendService {
  private client: Groq | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      this.client = new Groq({ apiKey });
    }
  }

  private getClient(apiKeyOverride?: string): Groq {
    if (apiKeyOverride && apiKeyOverride.trim().length > 0) {
      return new Groq({ apiKey: apiKeyOverride.trim() });
    }
    if (!this.client) {
      this.initClient();
    }
    if (!this.client) {
      throw new Error("Groq client not initialized. Check GROQ_API_KEY in backend environment.");
    }
    return this.client;
  }

  public isConfigured(): boolean {
    return !!process.env.GROQ_API_KEY;
  }

  public resolveModel(requestedModel?: string): string {
    if (!requestedModel) return DEFAULT_MODEL;
    if (ALLOWED_MODELS.includes(requestedModel)) return requestedModel;
    return DEFAULT_MODEL;
  }

  public resolveVisionModel(requestedModel?: string): string {
    if (requestedModel && ALLOWED_VISION_MODELS.includes(requestedModel)) {
      return requestedModel;
    }
    return DEFAULT_VISION_MODEL;
  }


  public buildSystemPrompt(
    context?: SessionContextData,
    taskMetadata?: TaskMetadata
  ): string {
    return buildCompressedSystemPrompt(context, taskMetadata);
  }


  /**
   * Stream a chat completion from Groq API.
   */
  public async streamChat(
    options: ChatStreamOptions,
    onChunk: (chunk: string) => void
  ): Promise<ChatStreamResult> {
    const client = this.getClient(options.apiKey);

    const meta: TaskMetadata | undefined =
      options.taskMetadata ||
      options.sessionContext?.taskMetadata ||
      (options.sessionContext
        ? {
            taskType: options.sessionContext.taskType,
            parentTaskType: options.sessionContext.parentTaskType,
            confidence: options.sessionContext.taskConfidence,
            tier: options.sessionContext.taskTier,
            suggestedDepth: options.sessionContext.suggestedDepth,
            requiresCode: options.sessionContext.requiresCode,
            boundedContext: options.sessionContext.boundedContext,
          }
        : undefined);

    const targetModel = this.resolveModel(options.model);
    const systemPrompt = this.buildSystemPrompt(options.sessionContext, meta);
    
    // Check if system prompt is already in messages, otherwise prepend
    const hasSystemMsg = options.messages.some((m) => m.role === "system");
    const fullMessages = hasSystemMsg
      ? options.messages
      : [{ role: "system" as const, content: systemPrompt }, ...options.messages];

    let stream: any;
    let modelUsed = targetModel;

    const userMsg = options.messages.filter((m) => m.role === "user").pop();
    const userQuestion = typeof userMsg?.content === "string" ? userMsg.content : "";

    const budgetResult = resolveOutputBudget({
      taskType: meta?.taskType,
      parentTaskType: meta?.parentTaskType,
      suggestedDepth: meta?.suggestedDepth,
      requiresCode: meta?.requiresCode,
      question: userQuestion,
      sessionContext: options.sessionContext,
      taskMetadata: meta,
      model: targetModel,
      isContinuation: options.isContinuation,
      previousAnswer: options.previousAnswer,
      isScreen: false,
      clientMaxTokens: options.maxTokens,
    });

    const targetMaxTokens = budgetResult.effectiveMaxTokens;

    const primaryParams: any = {
      model: targetModel,
      messages: fullMessages,
      max_tokens: targetMaxTokens,
      temperature: 0.55,
      stream: true,
    };
    const primaryReasoning = getReasoningFormatForModel(targetModel);
    if (primaryReasoning) {
      primaryParams.reasoning_format = primaryReasoning;
    }

    try {
      stream = await client.chat.completions.create(primaryParams, { signal: options.signal });
    } catch (err: any) {
      console.warn(`[GroqStreamChatFallback] Target ${targetModel} failed: status=${err?.status} msg=${err?.message}`);
      // Fallback model handling on 404 or specific model rate limits
      if (
        (err?.status === 404 || err?.message?.includes("does not exist") || err?.status === 429) &&
        targetModel !== FALLBACK_MODEL
      ) {
        modelUsed = FALLBACK_MODEL;
        const fbBudget = resolveOutputBudget({
          taskType: meta?.taskType,
          parentTaskType: meta?.parentTaskType,
          suggestedDepth: meta?.suggestedDepth,
          requiresCode: meta?.requiresCode,
          question: userQuestion,
          sessionContext: options.sessionContext,
          taskMetadata: meta,
          model: FALLBACK_MODEL,
          isContinuation: options.isContinuation,
          previousAnswer: options.previousAnswer,
          isScreen: false,
          clientMaxTokens: options.maxTokens,
        });
        const fallbackMaxTokens = fbBudget.effectiveMaxTokens;
        const fallbackParams: any = {
          model: FALLBACK_MODEL,
          messages: fullMessages,
          max_tokens: fallbackMaxTokens,
          temperature: 0.6,
          stream: true,
        };
        const fbReasoning = getReasoningFormatForModel(FALLBACK_MODEL);
        if (fbReasoning) {
          fallbackParams.reasoning_format = fbReasoning;
        }
        stream = await client.chat.completions.create(fallbackParams, { signal: options.signal });
      } else {
        throw err;
      }
    }

    let fullAnswer = "";
    const thinkFilter = new ThinkingStreamFilter();
    let finishReason: "stop" | "length" | "abort" | "error" | "unknown" = "unknown";
    let chunkCount = 0;
    const startTime = Date.now();

    for await (const chunk of stream) {
      chunkCount++;
      const fr = chunk.choices[0]?.finish_reason;
      if (fr) {
        if (fr === "stop" || fr === "length") {
          finishReason = fr;
        } else {
          finishReason = fr as any;
        }
      }

      const delta = chunk.choices[0]?.delta?.content || "";
      if (!delta) continue;

      const visible = thinkFilter.processChunk(delta);
      if (visible) {
        fullAnswer += visible;
        onChunk(visible);
      }
    }

    const trailing = thinkFilter.flush();
    if (trailing) {
      fullAnswer += trailing;
      onChunk(trailing);
    }

    if (options.signal?.aborted) {
      finishReason = "abort";
    } else if (finishReason === "unknown" && fullAnswer.length > 0) {
      finishReason = "stop";
    }

    const boundedContext = meta?.boundedContext || options.sessionContext?.boundedContext;
    const hasCandidateExperience = !!(
      (options.sessionContext?.resumeText && options.sessionContext.resumeText.trim().length >= 25) ||
      (options.sessionContext?.resume_text && options.sessionContext.resume_text.trim().length >= 25) ||
      (options.sessionContext?.notes && options.sessionContext.notes.trim().length >= 15) ||
      (boundedContext?.stableFacts && boundedContext.stableFacts.length > 0) ||
      (boundedContext?.candidateProfile?.skills && boundedContext.candidateProfile.skills.length > 0)
    );

    const hasCompanyContext = !!(
      options.sessionContext?.company &&
      options.sessionContext.company.trim().length > 1 &&
      !/^(unknown|target company|n\/a|none)$/i.test(options.sessionContext.company.trim())
    );

    const effectiveTaskType = meta?.taskType || options.sessionContext?.taskType || "GENERAL_TECHNICAL";
    const effectiveParentTaskType = meta?.parentTaskType || options.sessionContext?.parentTaskType;

    const qualityGate = verifyAnswerQuality(fullAnswer.trim(), {
      taskType: effectiveTaskType,
      parentTaskType: effectiveParentTaskType,
      hasCandidateExperience,
      hasCompanyContext,
      candidateContext: {
        resumeText: options.sessionContext?.resumeText || options.sessionContext?.resume_text,
        notes: options.sessionContext?.notes,
        skills: boundedContext?.candidateProfile?.skills,
        company: options.sessionContext?.company,
        stableFacts: boundedContext?.stableFacts,
      },
    });

    if (!qualityGate.passed) {
      console.warn(
        `[QualityGateWarning] req=${options.requestId || "unknown"} violations=${qualityGate.violations.map((v) => v.code).join(",")}`
      );
    }

    // Diagnostic operational logging (strictly private: no content/keys)
    console.log(
      `[GroqChatDiagnostic] req=${options.requestId || "unknown"} model=${modelUsed} fr=${finishReason} complete=${finishReason === "stop"} chunks=${chunkCount} dur=${Date.now() - startTime}ms chars=${fullAnswer.length} qualityPassed=${qualityGate.passed}`
    );

    return {
      fullAnswer: fullAnswer.trim(),
      modelUsed,
      finishReason,
      isComplete: finishReason === "stop",
      chunkCount,
      durationMs: Date.now() - startTime,
      qualityGate,
      outputBudget: budgetResult,
    };
  }

  /**
   * Stream screen / vision analysis from Groq API with 429 fallback and accurate diagnostics.
   */
  public async streamScreenAnalysis(
    options: ScreenAnalysisOptions,
    onChunk: (chunk: string) => void
  ): Promise<ScreenAnalysisResult> {
    const client = this.getClient(options.apiKey);

    const primaryModel = this.resolveVisionModel(options.model);
    const fallbackModel = primaryModel === DEFAULT_VISION_MODEL && FALLBACK_VISION_MODEL !== primaryModel
      ? FALLBACK_VISION_MODEL
      : null;

    const relevantResume = extractRelevantResumeContext(options.sessionContext, options.question);

    const baseQuestion = buildScreenAnalysisPrompt(options.question);

    const questionText = relevantResume
      ? `${baseQuestion}\n\n[CANDIDATE BACKGROUND]:\n${relevantResume}`
      : baseQuestion;


    const logErrorDiagnostics = (err: any, attemptedModel: string) => {
      try {
        const imageBytes = Buffer.byteLength(options.imageBase64, "base64");
        const imageMB = (imageBytes / (1024 * 1024)).toFixed(2);
        const status = err.status || err.statusCode || err.response?.status;
        const code = err.code || err.error?.code || err.type || "UNKNOWN";
        const message = err.message || err.error?.message || String(err);

        console.error("[GroqVisionDiagnostic] ========================================");
        console.error(`[GroqVisionDiagnostic] Timestamp: ${new Date().toISOString()}`);
        console.error(`[GroqVisionDiagnostic] Request ID: ${options.requestId || "none"}`);
        console.error(`[GroqVisionDiagnostic] Attempted Model: ${attemptedModel}`);
        console.error(`[GroqVisionDiagnostic] HTTP Status: ${status ?? "N/A"}`);
        console.error(`[GroqVisionDiagnostic] Error Code: ${code}`);
        console.error(`[GroqVisionDiagnostic] Error Message: ${message}`);
        console.error(`[GroqVisionDiagnostic] Image Payload: ${imageBytes} bytes (~${imageMB} MB)`);
        console.error(`[GroqVisionDiagnostic] Active Streams: ${options.activeStreamsCount ?? "N/A"}`);
        console.error("[GroqVisionDiagnostic] ========================================");
      } catch (logErr) {
        console.error("[GroqVisionDiagnostic] Failed to format diagnostic log:", logErr);
      }
    };

    const isRateLimitError = (err: any): boolean => {
      const status = err.status || err.statusCode || err.response?.status;
      const code = err.code || err.error?.code || err.type;
      const msg = (err.message || err.error?.message || "").toLowerCase();
      return (
        status === 429 ||
        code === "rate_limit_exceeded" ||
        code === "tokens" ||
        msg.includes("rate limit") ||
        msg.includes("tokens per minute") ||
        msg.includes("itpm")
      );
    };

    const extractRetrySecondsInternal = (err: any): number => {
      const parsed = extractRetrySeconds(err, options.requestId);
      return parsed.seconds;
    };

    let lastError: any = null;
    let chunksDispatchedForRequest = 0;

    const isFallbackEligibleError = (err: any): boolean => {
      const status = err?.status || err?.statusCode || err?.response?.status;
      const code = err?.code || err?.error?.code || err?.type;
      const msg = (err?.message || err?.error?.message || "").toLowerCase();

      // Auth errors (401, 403) are credential issues, not model issues -> do not fallback model
      if (status === 401 || status === 403 || code === "invalid_api_key") {
        return false;
      }

      // Client errors (400, 413) -> do not fallback
      if (status === 400 || status === 413 || msg.includes("payload too large")) {
        return false;
      }

      // Abort -> do not fallback
      if (err?.name === "AbortError" || options.signal?.aborted) {
        return false;
      }

      // Eligible: Rate limit (429), 5xx server errors, model decommissioned/not found (404/503), timeout
      return (
        isRateLimitError(err) ||
        status >= 500 ||
        status === 404 ||
        code === "model_decommissioned" ||
        code === "model_not_found" ||
        code === "ETIMEDOUT" ||
        msg.includes("rate limit") ||
        msg.includes("tokens per minute") ||
        msg.includes("itpm") ||
        msg.includes("service unavailable")
      );
    };

    const executeStream = async (targetModel: string): Promise<ScreenAnalysisResult> => {
      const screenBudget = resolveOutputBudget({
        taskType: options.taskMetadata?.taskType || options.sessionContext?.taskType,
        parentTaskType: options.taskMetadata?.parentTaskType || options.sessionContext?.parentTaskType,
        suggestedDepth: options.taskMetadata?.suggestedDepth || options.sessionContext?.suggestedDepth,
        requiresCode: options.taskMetadata?.requiresCode ?? options.sessionContext?.requiresCode,
        question: options.question,
        sessionContext: options.sessionContext,
        taskMetadata: options.taskMetadata,
        model: targetModel,
        isScreen: true,
        clientMaxTokens: options.maxTokens,
      });
      const maxTokens = screenBudget.effectiveMaxTokens;
      let finishReason: "stop" | "length" | "abort" | "error" | "unknown" = "unknown";
      let chunkCount = 0;
      const startTime = Date.now();

      const streamParams: any = {
        model: targetModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: questionText },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${options.imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: maxTokens,
        stream: true,
      };

      const reasoningFormat = getReasoningFormatForModel(targetModel);
      if (reasoningFormat) {
        streamParams.reasoning_format = reasoningFormat;
      }

      const stream: any = await client.chat.completions.create(streamParams, {
        signal: options.signal,
      });

      let fullAnswer = "";
      const thinkFilter = new ThinkingStreamFilter();

      for await (const chunk of stream) {
        chunkCount++;
        const fr = chunk.choices[0]?.finish_reason;
        if (fr) {
          if (fr === "stop" || fr === "length") {
            finishReason = fr;
          } else {
            finishReason = fr as any;
          }
        }

        const delta = chunk.choices[0]?.delta?.content || "";
        if (!delta) continue;

        const visible = thinkFilter.processChunk(delta);
        if (visible) {
          fullAnswer += visible;
          chunksDispatchedForRequest++;
          onChunk(visible);
        }
      }

      const trailing = thinkFilter.flush();
      if (trailing) {
        fullAnswer += trailing;
        chunksDispatchedForRequest++;
        onChunk(trailing);
      }

      if (options.signal?.aborted) {
        finishReason = "abort";
      } else if (finishReason === "unknown" && fullAnswer.length > 0) {
        finishReason = "stop";
      }

      console.log(
        `[GroqVisionDiagnostic] req=${options.requestId || "unknown"} model=${targetModel} fr=${finishReason} complete=${finishReason === "stop"} chunks=${chunkCount} dur=${Date.now() - startTime}ms chars=${fullAnswer.length} ceilingLimited=${screenBudget.ceilingLimited}`
      );

      return {
        fullAnswer: fullAnswer.trim(),
        modelUsed: targetModel,
        finishReason,
        isComplete: finishReason === "stop",
        chunkCount,
        durationMs: Date.now() - startTime,
        outputBudget: screenBudget,
      };
    };

    // 1. Attempt Primary Vision Model
    try {
      const primaryRes = await executeStream(primaryModel);
      if (primaryRes.fullAnswer && primaryRes.fullAnswer.length > 0) {
        return primaryRes;
      }
      console.warn(
        `[GroqVision] Primary vision model '${primaryModel}' yielded empty content. Falling back to '${fallbackModel}'...`
      );
      if (fallbackModel && chunksDispatchedForRequest === 0) {
        return await executeStream(fallbackModel);
      }
      return primaryRes;
    } catch (err: any) {
      lastError = err;
      logErrorDiagnostics(err, primaryModel);

      // 2. Fallback to secondary vision model ONLY IF:
      // - A fallback model is configured
      // - No chunks were dispatched yet (stream safety: chunksDispatchedForRequest === 0)
      // - Error is eligible (429, 5xx, 404, etc. - NOT 401/403/400/413/abort)
      if (fallbackModel && chunksDispatchedForRequest === 0 && isFallbackEligibleError(err)) {
        console.warn(
          `[GroqVision] Primary vision model '${primaryModel}' failed pre-stream (status=${err?.status} code=${err?.code}). Attempting fallback to '${fallbackModel}'...`
        );
        try {
          return await executeStream(fallbackModel);
        } catch (fallbackErr: any) {
          lastError = fallbackErr;
          logErrorDiagnostics(fallbackErr, fallbackModel);
        }
      }
    }

    // 3. Classify and handle error accurately
    const is429 = isRateLimitError(lastError);
    const retryResult = is429 ? extractRetrySeconds(lastError, options.requestId) : undefined;
    const retrySeconds = retryResult?.seconds;
    const status = lastError?.status || lastError?.statusCode || lastError?.response?.status;
    const code = lastError?.code || lastError?.error?.code || lastError?.type;
    const msg = (lastError?.message || lastError?.error?.message || "").toLowerCase();

    let errorCode = "AI_PROVIDER_ERROR";
    let notice = "*(Screen captured)* Screen analysis failed. Please try again.";

    if (is429) {
      errorCode = "RATE_LIMIT_EXCEEDED";
      notice = `*(Screen captured)* Screen analysis is temporarily rate-limited. Please try again in ~${retrySeconds} seconds.`;
    } else if (
      status === 413 ||
      msg.includes("payload too large") ||
      msg.includes("too large") ||
      msg.includes("invalid image data")
    ) {
      errorCode = "IMAGE_TOO_LARGE";
      notice = "*(Screen captured)* Screenshot payload is too large or invalid. Please try capturing again.";
    } else if (
      code === "model_decommissioned" ||
      code === "model_not_found" ||
      msg.includes("multimodal") ||
      msg.includes("does not support") ||
      msg.includes("decommissioned")
    ) {
      errorCode = "MODEL_CONFIGURATION_ERROR";
      notice = "*(Screen captured)* Screen vision model is unavailable or misconfigured. Please verify model settings.";
    } else if (status === 401 || status === 403 || code === "invalid_api_key") {
      errorCode = "AI_AUTH_ERROR";
      notice = "*(Screen captured)* Groq authentication error. Please verify your Groq API credentials.";
    } else if (
      lastError?.name === "AbortError" ||
      code === "ETIMEDOUT" ||
      status === 408 ||
      msg.includes("timeout")
    ) {
      errorCode = "AI_TIMEOUT";
      notice = "*(Screen captured)* Screen analysis timed out. Please try again.";
    } else if (status >= 500) {
      errorCode = "AI_PROVIDER_ERROR";
      notice = "*(Screen captured)* Groq service error. Please try again in a moment.";
    }

    onChunk(notice);
    return {
      fullAnswer: notice,
      modelUsed: "error-notice",
      isError: true,
      errorCode,
      retryAfterSeconds: retrySeconds,
      finishReason: "error",
      isComplete: false,
    };
  }
}

export const groqBackendService = new GroqBackendService();
