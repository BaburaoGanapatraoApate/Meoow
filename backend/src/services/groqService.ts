import Groq from "groq-sdk";
import dotenv from "dotenv";
import { verifyAnswerQuality, QualityCheckResult } from "./qualityGate";

dotenv.config();

export const ALLOWED_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "groq/compound-mini",
  "groq/compound"
];

export const DEFAULT_MODEL = "qwen/qwen3.8-27b";
export const FALLBACK_MODEL = "openai/gpt-oss-120b";

export const DEFAULT_VISION_MODEL = "qwen/qwen3.6-27b";
export const FALLBACK_VISION_MODEL = "qwen/qwen3.8-27b";
export const ALLOWED_VISION_MODELS = [
  "qwen/qwen3.6-27b",
  "qwen/qwen3.8-27b",
];

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
}

export interface ChatStreamResult {
  fullAnswer: string;
  modelUsed: string;
  finishReason: "stop" | "length" | "abort" | "error" | "unknown";
  isComplete: boolean;
  chunkCount: number;
  durationMs: number;
  qualityGate?: QualityCheckResult;
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
 */
/**
 * Return specific interview answer strategy instructions for a given task type.
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
  const effectiveType = taskType === "FOLLOW_UP" && parentTaskType ? parentTaskType : taskType;

  switch (effectiveType) {
    case "CODING":
      return `TASK STRATEGY — CODING INTERVIEW:
1. SPOKEN APPROACH FIRST: In the first 1-2 sentences, verbally state your algorithmic approach, chosen data structure, and why ("I'd solve this using a two-pointer approach with a hash map to achieve linear time...").
2. IMPLEMENTATION: Write clean, optimal, production-ready code with concise inline comments.
3. COMPLEXITY: State exact Big-O Time Complexity and Space Complexity.
4. EDGE CASES: State 2-3 specific edge cases your solution accounts for (e.g., empty collection, duplicates, boundary limits).
5. NEVER solve a different problem. Keep the verbal explanation crisp.`;

    case "SQL":
      return `TASK STRATEGY — SQL QUERY:
1. DIRECT QUERY FIRST: Provide the clean, formatted SQL query immediately.
2. SPOKEN LOGIC: In 1-3 conversational sentences, explain the query logic (e.g., why a window function like DENSE_RANK() or CTE was chosen, join logic, aggregations).
3. PERFORMANCE & INDEXING: Mention index considerations or query performance tradeoffs when relevant.`;

    case "DEBUGGING":
      return `TASK STRATEGY — DEBUGGING & ROOT CAUSE:
1. DIRECT ROOT CAUSE FIRST: Sentence 1 must state the exact root cause of the bug or exception directly ("The root cause is an off-by-one indexing error where...").
2. EVIDENCE & REASONING: Explain why the error occurs in 1-2 sentences.
3. EXACT CODE FIX: Show the corrected line(s) or snippet.
4. DEFENSIVE PREVENTION: In 1 sentence, explain how to defensively prevent this in production (e.g., input validation, bounds check, type narrowing).`;

    case "CONCEPTUAL":
    case "THEORETICAL_CONCEPT":
      return `TASK STRATEGY — CONCEPTUAL & THEORETICAL:
1. DIRECT DEFINITION FIRST: Sentence 1 must directly define the concept or answer the core question ("The key difference is that X operates at layer Y whereas Z...").
2. UNDER THE HOOD MECHANISM: In 1-2 sentences, explain how it works internally (memory layout, execution model, protocol).
3. PRACTICAL EXAMPLE / TRADE-OFF: Give a real-world scenario or concrete engineering trade-off where you would choose one over the other.
4. DYNAMIC DEPTH: Keep it tight (~20-40 seconds spoken, 3-5 sentences total). STRICTLY NO CODE unless explicitly requested.`;

    case "ML_DESIGN":
      return `TASK STRATEGY — MACHINE LEARNING SYSTEM DESIGN:
1. PROBLEM FORMULATION & TARGET: Sentence 1 states the mathematical formulation (e.g., regression vs ranking, point estimate vs quantile loss) and business objective.
2. DATA & FEATURE ENGINEERING: Outline key features (spatial, temporal, categorical embeddings, real-time streaming vs batch features) and explicitly state how you prevent data leakage (time-based train/test splits).
3. MODEL SELECTION & RATIONALE: State baseline model (e.g., historical average or logistic regression) and primary chosen model (e.g., LightGBM/XGBoost for tabular features, or deep neural ranking) with concrete reasoning for why it fits this latency/scale profile.
4. EVALUATION: State offline metrics (e.g., MAE, RMSE, AUC-PR) vs online A/B testing business metrics.
5. SERVING & LATENCY: Outline feature store lookup, caching, and inference SLA considerations.
6. MONITORING & DRIFT: Mention model drift detection (feature drift, concept drift) and retraining cadence.
7. CRITICAL RULE: This is an architectural system discussion. DO NOT write training code or Python scripts unless explicitly instructed!`;

    case "SYSTEM_DESIGN":
      return `TASK STRATEGY — DISTRIBUTED SYSTEM DESIGN:
1. REQUIREMENTS & SCALE ASSUMPTIONS: Sentence 1 explicitly frames scale numbers as interview assumptions rather than stated facts (e.g., "To make the design concrete, I'll assume an estimated scale of roughly 50,000 QPS with an 80/20 read/write ratio and a 100ms latency SLA..."). NEVER state invented scale numbers as authoritative personal facts or pretend real production experience with these numbers unless specified in the prompt.
2. HIGH-LEVEL ARCHITECTURE & DATA FLOW: Walk through the request lifecycle (Client -> CDN/LB -> API Gateway -> Stateless Services -> Cache -> Database).
3. COMPONENT JUSTIFICATION: For each major architectural choice, state WHY (e.g., "We choose Redis for caching hot session keys because...", "We use Kafka for async message decoupling because...").
4. BOTTLENECKS & FAILURE MODES: Address single points of failure, partition tolerance, database replication/sharding, and failover strategy.
5. OBSERVABILITY & TRADE-OFFS: Mention metrics, distributed tracing, and consistency vs availability trade-offs (CAP theorem).
6. CRITICAL RULE: Provide structured senior-level architectural reasoning. Do not just throw buzzwords without rationale.`;

    case "CASE_STUDY":
      return `TASK STRATEGY — CASE STUDY & PRODUCT SCENARIO:
1. OBJECTIVE & SCOPE: Sentence 1 clarifies the primary objective, boundary constraints, and target metric.
2. STRUCTURED APPROACH: Framework: Objectives -> Key Assumptions -> Analysis & Trade-offs -> Action Plan -> Risks & Mitigation.
3. DECISION RATIONALE: Articulate why the chosen path maximizes the target metric while managing risk.
4. NO UNNECESSARY CODE: Keep it focused on engineering strategy, system tradeoffs, and execution.`;

    case "BEHAVIORAL": {
      const hasExp = options?.hasCandidateExperience ?? false;
      if (!hasExp) {
        return `TASK STRATEGY — BEHAVIORAL & LEADERSHIP:
1. NO CANDIDATE EXPERIENCE PROVIDED — STRICT PERSONALIZATION SCAFFOLD:
   - Candidate-specific history is NOT provided in the resume, notes, or context.
   - ABSOLUTE PROHIBITION: You MUST NOT invent a personal story, incident, production outage, or claim you resolved one ("I led...", "I built...", "I resolved...", "At my previous company...").
   - Instead, deliver a concise spoken verbal framework that explains how the candidate should structure their answer, with explicit personalization scaffolds/placeholders in brackets:
     "I'd frame this around a real incident from my experience. [Replace this with your specific incident, e.g., a database connection pool exhaustion or cache stampede.] The key is to walk through what I personally did: first, [state your immediate action or data-driven triage], then how I communicated with the team to coordinate the fix, and finally the resolution. I'd finish with what I learned about [e.g., proactive monitoring, blameless post-mortems]..."
2. SPOKEN STORYTELLING & STRUCTURE:
   - Deliver an engaging, concise spoken guide. Follow: Context -> Personal Action -> Outcome -> Reflection.
   - DO NOT output literal section labels like "Situation:", "Task:", "Action:", "Result:". Speak naturally as if answering aloud.
3. STRICT ANTI-FABRICATION RULES:
   - NEVER invent personal metrics, percentages (e.g. "improved performance by 30%"), latency numbers, cost savings, team sizes, or revenue.
   - NEVER invent company names, client names, project titles, responsibilities, or fake achievements.
   - ONLY cite specific metrics, numbers, companies, or projects if they are explicitly provided in the candidate context/resume/notes.
   - IF NO METRICS EXIST IN CONTEXT: Focus on qualitative engineering impact (e.g., "which eliminated deployment rollbacks during our peak release cycle") or use an explicit placeholder like "[e.g., reduced deployment cycle by X%]". Do NOT force a quantified result when none exists.`;
      }

      return `TASK STRATEGY — BEHAVIORAL & LEADERSHIP:
1. SPOKEN STORYTELLING: Speak naturally in the first person ("I"). Deliver an engaging, concise story grounded strictly in the candidate's authentic background provided below.
2. PERSONAL AGENCY: Focus on what YOU individually did, your decision-making process, and leadership, not vague collective actions ("I organized a retrospective with the team to identify the bottleneck...").
3. TRUTHFUL OUTCOME & REFLECTIVE LEARNING: Describe the specific engineering action and qualitative outcome. Close with 1 sentence reflecting on what you learned or how it shaped your engineering practice.
4. FORMATTING: DO NOT output literal section labels like "Situation:", "Task:", "Action:", "Result:". Speak naturally as if answering aloud.
5. STRICT ANTI-FABRICATION RULES:
   - NEVER invent personal metrics, percentages (e.g. "improved performance by 30%"), latency numbers, cost savings, team sizes, or revenue.
   - NEVER invent company names, client names, project titles, responsibilities, or fake achievements.
   - ONLY cite specific metrics, numbers, companies, or projects if they are explicitly provided in the candidate context/resume/notes.
   - IF NO METRICS EXIST IN CONTEXT: Focus on qualitative engineering impact (e.g., "which eliminated deployment rollbacks during our peak release cycle") or use an explicit placeholder like "[e.g., reduced deployment cycle by X%]". Do NOT force a quantified result when none exists.`;
    }

    case "HR": {
      const hasComp = options?.hasCompanyContext ?? false;
      if (!hasComp) {
        return `TASK STRATEGY — HR & CULTURE FIT:
1. DIRECT ANSWER FIRST: Sentence 1 answers the question directly (e.g., for motivation, notice period, compensation, or career goals).
2. TRANSFERABLE VALUES & AUTHENTIC FIT:
   - When no specific company context is provided, speak to transferable engineering values, collaboration principles, and standard best practices.
   - DO NOT invent company-specific details, products, internal teams, mission statements, or private company culture.
3. AUTHENTIC & CONCISE: Speak with genuine enthusiasm, professionalism, and clarity without corporate platitudes or sycophancy (3-4 sentences total).
4. STRICT ANTI-FABRICATION RULES:
   - NEVER invent past companies, university degrees, project achievements, or career timeline details not present in the candidate context.
   - ONLY reference specific employers, tools, or domain experience if supplied in the resume or session context.
   - If candidate-specific details are not provided, speak to transferable engineering values and sound general practices without fabricating credentials.`;
      }

      return `TASK STRATEGY — HR & CULTURE FIT:
1. DIRECT ANSWER FIRST: Sentence 1 answers the question directly (e.g., for motivation, notice period, compensation, or career goals).
2. MOTIVATION & VALUE PROPOSITION:
   - Connect your background and work ethic with the role and engineering challenges truthfully.
   - Connect your authentic background truthfully with the target company and role. Use only the provided company name and role details; do not invent internal products or teams.
3. AUTHENTIC & CONCISE: Speak with genuine enthusiasm, professionalism, and clarity without corporate platitudes or sycophancy (3-4 sentences total).
4. STRICT ANTI-FABRICATION RULES:
   - NEVER invent past companies, university degrees, project achievements, or career timeline details not present in the candidate context.
   - ONLY reference specific employers, tools, or domain experience if supplied in the resume or session context.
   - If candidate-specific details are not provided, speak to transferable engineering values and sound general practices without fabricating credentials.`;
    }

    case "MCQ":
      return `TASK STRATEGY — MULTIPLE CHOICE (MCQ):
1. OPTION AND ANSWER FIRST: Sentence 1 states the correct option letter and text immediately ("The correct option is B: O(log N)...").
2. CONCISE EXPLANATION: In 1-2 crisp sentences, explain why this option is correct and why the primary distractor is incorrect.
3. STRICTLY NO ESSAYS: Keep it under 40 words.`;

    case "FOLLOW_UP":
      return `TASK STRATEGY — FOLLOW-UP QUESTION:
1. DIRECT ANSWER TO IMMEDIATE QUESTION: Sentence 1 answers the specific follow-up directly without hesitation.
2. LEVERAGE ACTIVE CONTEXT & TRUTHFUL GROUNDING: Build upon the established decisions and discussion thread without repeating the entire previous explanation. Strictly reference only facts, technologies, and metrics established in the active context; do not introduce new fabricated credentials or unanchored claims.
3. CONCRETE REASONING: Give the specific justification, trade-off, or optimization asked for.`;

    case "COMPARISON":
      return `TASK STRATEGY — TECHNICAL COMPARISON:
1. DIRECT VERDICT FIRST: Sentence 1 summarizes the fundamental difference or when to choose which.
2. DIMENSION COMPARISON: Compare across 2-3 key dimensions (performance/latency, complexity, operational overhead, use-case fit).
3. PRACTICAL RECOMMENDATION: State concrete guideline on when to use A vs B.`;

    default:
      return `TASK STRATEGY — GENERAL TECHNICAL INTERVIEW:
1. DIRECT ANSWER FIRST: Sentence 1 directly answers the core question.
2. REASONING & DEPTH: Explain the technical rationale clearly, providing a concrete example or practical trade-off.
3. CONCISE & ARTICULATE: Sound like a knowledgeable senior engineer speaking naturally in a live conversation (~30-60 seconds spoken).`;
  }
}

/**
 * Format bounded context snapshot into structured prompt text.
 */
export function formatBoundedContextForPrompt(boundedContext?: any): string {
  if (!boundedContext) return "";
  const parts: string[] = [];

  if (boundedContext.activeThread) {
    parts.push(`ACTIVE THREAD TOPIC: ${boundedContext.activeThread.parentTopic} (${boundedContext.activeThread.taskType})`);
    if (boundedContext.activeThread.decisions?.length > 0) {
      parts.push(`ESTABLISHED DECISIONS IN THREAD: ${boundedContext.activeThread.decisions.join("; ")}`);
    }
  }

  if (boundedContext.screenObservation) {
    parts.push(`LATEST SCREEN OBSERVATION: Problem: "${boundedContext.screenObservation.problem}"`);
    if (boundedContext.screenObservation.entities?.length > 0) {
      parts.push(`KEY CONSTRAINTS ON SCREEN: ${boundedContext.screenObservation.entities.join(", ")}`);
    }
  }

  if (boundedContext.recentTurns?.length > 0) {
    const dialog = boundedContext.recentTurns
      .map((t: any) => {
        let speakerName = "Interviewer";
        if (t.speaker === "candidate") speakerName = "Candidate";
        else if (t.speaker === "meoow") speakerName = "Meoow";

        const sourceTag = t.source ? ` (${t.source})` : "";
        return `${speakerName}${sourceTag}: ${t.text}`;
      })
      .join("\n");
    parts.push(`RECENT CONVERSATION CONTEXT (CHRONOLOGICAL DIALOGUE):\n${dialog}`);
  }

  if (boundedContext.stableFacts?.length > 0) {
    parts.push(`STABLE FACTS: ${boundedContext.stableFacts.join("; ")}`);
  }

  if (boundedContext.candidateProfile) {
    parts.push(`CANDIDATE ROLE: ${boundedContext.candidateProfile.level || ""} ${boundedContext.candidateProfile.role || ""} | SKILLS: ${boundedContext.candidateProfile.skills?.join(", ") || "General"}`);
  }

  return parts.length > 0
    ? `\n\n=== BOUNDED INTERVIEW CONTEXT ===\n${parts.join("\n\n")}\n=================================\n`
    : "";
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
    const jobTitle = context?.jobTitle || context?.job_title || "Software Engineer";
    const company = context?.company ? ` at ${context.company}` : "";
    const experienceLevel = context?.experienceLevel || context?.experience_level || "mid-level";
    const interviewRound = (context?.interviewRound || context?.interview_round || "technical").toLowerCase();

    const isHrRound =
      interviewRound === "hr_screening" ||
      interviewRound === "hr" ||
      interviewRound === "behavioral" ||
      interviewRound === "culture_fit";

    const effectiveTaskType =
      taskMetadata?.taskType ||
      context?.taskType ||
      (isHrRound ? (interviewRound === "behavioral" ? "BEHAVIORAL" : "HR") : "GENERAL_TECHNICAL");

    const effectiveParentTaskType =
      taskMetadata?.parentTaskType || context?.parentTaskType;

    const requiresCode =
      taskMetadata?.requiresCode !== undefined
        ? taskMetadata.requiresCode
        : context?.requiresCode;

    const boundedContext = taskMetadata?.boundedContext || context?.boundedContext;
    const hasCandidateExperience = !!(
      (context?.resumeText && context.resumeText.trim().length >= 25) ||
      (context?.resume_text && context.resume_text.trim().length >= 25) ||
      (context?.notes && context.notes.trim().length >= 15) ||
      (boundedContext?.stableFacts && boundedContext.stableFacts.length > 0) ||
      (boundedContext?.candidateProfile?.skills && boundedContext.candidateProfile.skills.length > 0)
    );

    const hasCompanyContext = !!(
      context?.company &&
      context.company.trim().length > 1 &&
      !/^(unknown|target company|n\/a|none)$/i.test(context.company.trim())
    );

    const strategyInstructions = getTaskStrategyInstructions(
      effectiveTaskType,
      effectiveParentTaskType,
      requiresCode,
      { hasCandidateExperience, hasCompanyContext }
    );

    const boundedContextBlock = formatBoundedContextForPrompt(
      boundedContext
    );

    let prompt = `You are the candidate in a live technical job interview for a ${experienceLevel} ${jobTitle}${company} (${interviewRound} round).
You are answering the interviewer's questions in real time. Your persona is a poised, articulate, senior-level candidate who demonstrates deep engineering judgment, clear trade-off evaluation, and practical real-world experience.

CRITICAL SPOKEN-ANSWER-FIRST GUIDELINES:
1. PRIMARY CANDIDATE PERSONA:
   - When answering technical, coding, conceptual, system design, or ML design questions: Speak in FIRST PERSON ("I", "my") as the candidate explaining your reasoning and architecture directly.
   - When answering BEHAVIORAL questions WITH candidate background: Speak in first person ("I") grounding your narrative strictly in the authentic experience provided below.
   - When answering BEHAVIORAL questions WITHOUT candidate background: You MUST NOT fabricate or invent a personal story, past employer, or production incident that you allegedly experienced ("I led...", "I resolved...", "At my previous company..."). Instead, provide a spoken answer framework using personalization scaffolds in brackets (e.g., "I'd frame this around a real incident from my experience. [Replace this with your specific incident, e.g., a database connection pool exhaustion or cache stampede.] The key is to walk through what I personally did: first, [state your immediate action or data-driven triage], then how I communicated with the team to coordinate the fix, and finally the resolution. I'd finish with what I learned about [e.g., proactive monitoring, blameless post-mortems]...").
2. SENTENCE 1 MUST ANSWER DIRECTLY: Provide the direct, core answer in the very first sentence. Never evade, stall, or beat around the bush.
3. NATURAL SPOKEN ARTICULATION: Use crisp conversational speech that sounds natural when spoken aloud:
   - "I'd approach this in two main parts..."
   - "The primary reason I'd choose X over Y is..."
   - "The key trade-off here is write latency versus read availability..."
4. STRICTLY FORBIDDEN OPENINGS & FILLER:
   - NEVER start with: "That's a great question!", "Sure!", "In today's fast-paced world...", "First of all, I'd like to say...", "It depends" (unless immediately followed by specific technical trade-offs).
   - NEVER use textbook definitions or generic corporate fluff.
5. ANTI-FABRICATION:
   - If candidate resume details are provided below, leverage them authentically.
   - If candidate-specific background is NOT provided, NEVER invent fictitious employers, metrics, production incidents, or team sizes. Use realistic engineering scenarios or explicitly indicate what the candidate should personalize.
6. SYSTEM DESIGN ASSUMPTION FRAMING:
   - In system design and scale discussions, explicitly frame scale numbers and throughput as assumptions (e.g., "To make the design concrete, I'll assume an estimated scale of roughly 50,000 QPS..."). Never assert invented scale numbers as personal production facts.
7. DYNAMIC DEPTH:
   - Simple conceptual / MCQ: ~20-40 seconds spoken (~2-4 sentences).
   - Normal technical / Coding: ~30-60 seconds spoken.
   - Complex ML Design / System Design / Case Study: ~60-120 seconds structured candidate monologue.
8. STT ROBUSTNESS: Live speech-to-text transcripts may contain minor phonetic misrecognitions of technical terms (e.g. 'state' for 'set', 'sink' for 'sync', 'py torch' for 'PyTorch', 'e c two' for 'EC2'). Intelligently deduce the intended concept and answer directly without commenting on any transcript glitch.
9. CONVERSATIONAL CONTINUITY & PRIOR QUESTION RECALL:
   - If the user or interviewer asks about earlier questions, discussion history, or past topics (e.g., "What are the two questions I asked you previously?", "What topic were we discussing?", "What did I ask earlier?"):
     * Directly inspect the RECENT CONVERSATION CONTEXT (CHRONOLOGICAL DIALOGUE) below.
     * Accurately name, list, or enumerate the specific earlier questions asked by the candidate or interviewer as recorded in the chronological dialogue.
     * NEVER state that you have no earlier questions or context if prior questions are present in the chronological dialogue.

==================================================
CURRENT INTERVIEW TASK: ${effectiveTaskType}${effectiveParentTaskType ? ` (Follow-up to ${effectiveParentTaskType})` : ""}
==================================================

${strategyInstructions}
${boundedContextBlock}`;

    if (context) {
      const resume = context.resumeText || context.resume_text;
      if (resume) {
        prompt += `\n\nCANDIDATE'S ACTUAL BACKGROUND (use this authentic experience; NEVER invent beyond this):\n${resume.slice(0, 2000)}`;
      }
      if (context.notes) {
        prompt += `\n\nINTERVIEW FOCUS NOTES:\n${context.notes.slice(0, 800)}`;
      }
    }

    prompt += `\n\nREMEMBER: You are speaking aloud as the candidate. Sentence 1 answers directly. Concrete reasoning over buzzwords. No filler.`;

    return prompt;
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
    const requestedMaxTokens = options.maxTokens || 1024;

    try {
      stream = await client.chat.completions.create(
        {
          model: targetModel,
          messages: fullMessages,
          max_tokens: requestedMaxTokens,
          temperature: 0.55,
          stream: true,
        },
        { signal: options.signal }
      );
    } catch (err: any) {
      console.warn(`[GroqStreamChatFallback] Target ${targetModel} failed: status=${err?.status} msg=${err?.message}`);
      // Fallback model handling on 404 or specific model rate limits
      if (
        (err?.status === 404 || err?.message?.includes("does not exist") || err?.status === 429) &&
        targetModel !== FALLBACK_MODEL
      ) {
        modelUsed = FALLBACK_MODEL;
        stream = await client.chat.completions.create(
          {
            model: FALLBACK_MODEL,
            messages: fullMessages,
            max_tokens: options.maxTokens || 800,
            temperature: 0.6,
            stream: true,
          },
          { signal: options.signal }
        );
      } else {
        throw err;
      }
    }

    let fullAnswer = "";
    let inThinkBlock = false;
    let buffer = "";
    const isQwen = modelUsed.includes("qwen");
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

      if (!isQwen) {
        fullAnswer += delta;
        onChunk(delta);
        continue;
      }

      // Filter <think>...</think> tags if Qwen emits thinking blocks
      buffer += delta;
      while (buffer.length > 0) {
        if (!inThinkBlock) {
          const thinkStart = buffer.indexOf("<think>");
          if (thinkStart !== -1) {
            if (thinkStart > 0) {
              const text = buffer.slice(0, thinkStart);
              fullAnswer += text;
              onChunk(text);
            }
            inThinkBlock = true;
            buffer = buffer.slice(thinkStart + 7);
          } else {
            let hasPartial = false;
            for (let len = Math.min(buffer.length, 6); len > 0; len--) {
              if ("<think>".startsWith(buffer.slice(-len))) {
                const safe = buffer.slice(0, -len);
                if (safe) {
                  fullAnswer += safe;
                  onChunk(safe);
                }
                buffer = buffer.slice(-len);
                hasPartial = true;
                break;
              }
            }
            if (!hasPartial) {
              fullAnswer += buffer;
              onChunk(buffer);
              buffer = "";
            } else {
              break;
            }
          }
        } else {
          const thinkEnd = buffer.indexOf("</think>");
          if (thinkEnd !== -1) {
            inThinkBlock = false;
            buffer = buffer.slice(thinkEnd + 8).replace(/^\s+/, "");
          } else {
            buffer = "";
          }
        }
      }
    }

    if (buffer && !inThinkBlock) {
      fullAnswer += buffer;
      onChunk(buffer);
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
    const fallbackModel = primaryModel === DEFAULT_VISION_MODEL ? FALLBACK_VISION_MODEL : null;

    const questionText =
      options.question ||
      `You are an expert technical interview co-pilot assisting the candidate in real time from a live screen capture.

TASK & ANALYSIS OBJECTIVE (SINGLE PASS):
1. EXAMINE THE SCREEN: Identify what is visible (coding question, ML/system design problem, SQL problem, MCQ, debugging trace, or conceptual slide).
2. SELECT THE APPROPRIATE STRATEGY INTERNALLY:
   - IF ML DESIGN OR CASE STUDY (e.g., "Design an ETA prediction ML system", "Recommendation architecture"):
     Provide structured ML system design reasoning: problem framing & target, data & features, leakage prevention, baseline vs chosen model (with WHY), offline/online eval, latency/serving, drift monitoring, trade-offs.
     CRITICAL: DO NOT automatically generate Python or training code!
   - IF SYSTEM DESIGN (e.g., "Design a URL shortener", "Design Twitter"):
     Provide structured architecture reasoning: scale assumptions, component choices + WHY, bottlenecks, failure modes, replication, observability. DO NOT generate code.
   - IF CODING PROBLEM (e.g., LeetCode, "Write a function...", "Implement..."):
     1-2 sentence spoken approach first, clean optimal code block, Big-O time and space complexity, and edge cases handled.
   - IF SQL QUERY:
     Formatted SQL query first, followed by clear 1-2 sentence explanation of joins/aggregations/window logic and index considerations.
   - IF MULTIPLE CHOICE QUESTION (MCQ):
     State the correct option letter and text in sentence 1, followed by a concise 1-2 sentence reason why it is correct.
   - IF ERROR / DEBUGGING:
     State root cause in sentence 1, exact fix code, and prevention tip.
   - IF CONCEPTUAL QUESTION:
     Direct definition/answer in sentence 1, under-the-hood mechanism, example, and trade-off. No code.
   - IF AMBIGUOUS:
     Provide conservative, high-level analytical reasoning. NEVER default to code generation!

RULES:
- DIRECT SPOKEN ANSWER FIRST: Provide the immediate, actionable solution that the candidate can say aloud.
- DO NOT describe the screenshot, IDE chrome, window frames, or say "In this screenshot...".
- NO generic textbook filler.`;


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

    const executeStream = async (targetModel: string): Promise<ScreenAnalysisResult> => {
      const isQwen36 = targetModel.includes("qwen3.6");
      const maxTokens = isQwen36 ? 800 : 1024;
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

      const stream: any = await client.chat.completions.create(streamParams, {
        signal: options.signal,
      });

      let fullAnswer = "";
      let inThinkBlock = false;
      let buffer = "";

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

        if (!isQwen36) {
          fullAnswer += delta;
          onChunk(delta);
          continue;
        }

        // For Qwen 3.6, strip internal <think> ... </think> tags
        buffer += delta;

        while (buffer.length > 0) {
          if (!inThinkBlock) {
            const thinkStart = buffer.indexOf("<think>");
            if (thinkStart !== -1) {
              if (thinkStart > 0) {
                const text = buffer.slice(0, thinkStart);
                fullAnswer += text;
                onChunk(text);
              }
              inThinkBlock = true;
              buffer = buffer.slice(thinkStart + 7);
            } else {
              let hasPartial = false;
              for (let len = Math.min(buffer.length, 6); len > 0; len--) {
                if ("<think>".startsWith(buffer.slice(-len))) {
                  const safe = buffer.slice(0, -len);
                  if (safe) {
                    fullAnswer += safe;
                    onChunk(safe);
                  }
                  buffer = buffer.slice(-len);
                  hasPartial = true;
                  break;
                }
              }
              if (!hasPartial) {
                fullAnswer += buffer;
                onChunk(buffer);
                buffer = "";
              } else {
                break;
              }
            }
          } else {
            const thinkEnd = buffer.indexOf("</think>");
            if (thinkEnd !== -1) {
              inThinkBlock = false;
              buffer = buffer.slice(thinkEnd + 8).replace(/^\s+/, "");
            } else {
              buffer = "";
            }
          }
        }
      }

      if (buffer && !inThinkBlock) {
        fullAnswer += buffer;
        onChunk(buffer);
      }

      if (options.signal?.aborted) {
        finishReason = "abort";
      } else if (finishReason === "unknown" && fullAnswer.length > 0) {
        finishReason = "stop";
      }

      console.log(
        `[GroqVisionDiagnostic] req=${options.requestId || "unknown"} model=${targetModel} fr=${finishReason} complete=${finishReason === "stop"} chunks=${chunkCount} dur=${Date.now() - startTime}ms chars=${fullAnswer.length}`
      );

      return {
        fullAnswer: fullAnswer.trim(),
        modelUsed: targetModel,
        finishReason,
        isComplete: finishReason === "stop",
        chunkCount,
        durationMs: Date.now() - startTime,
      };
    };

    let lastError: any = null;

    // 1. Attempt Primary Vision Model
    try {
      const primaryRes = await executeStream(primaryModel);
      if (primaryRes.fullAnswer && primaryRes.fullAnswer.length > 0) {
        return primaryRes;
      }
      console.warn(
        `[GroqVision] Primary vision model '${primaryModel}' yielded empty content. Falling back to '${fallbackModel}'...`
      );
      if (fallbackModel) {
        return await executeStream(fallbackModel);
      }
      return primaryRes;
    } catch (err: any) {
      lastError = err;
      logErrorDiagnostics(err, primaryModel);

      // 2. If 429 Rate Limit, attempt Fallback Vision Model ONCE
      if (isRateLimitError(err) && fallbackModel) {
        console.warn(
          `[GroqVision] Primary vision model '${primaryModel}' hit rate limit (429). Attempting fallback to '${fallbackModel}'...`
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
