/**
 * ============================================================================
 * PROMPT COMPRESSION ENGINE (CANONICAL IMPLEMENTATION)
 * ============================================================================
 * Task 7: Composable, deterministic AI prompt compression system.
 *
 * Target Architecture:
 *   BASE_INTERVIEW_RULES + TASK_STRATEGY_MODULE + REQUEST_MODULE +
 *   BOUNDED_CONTEXT + USER_REQUEST
 *
 * Invariants:
 * - Direct spoken-answer first in Sentence 1.
 * - Strict anti-fabrication (never invent employers, credentials, metrics, incidents).
 * - Senior conversational interview articulation.
 * - Complete runnable code, Big-O complexity, edge cases for CODING.
 * - Formatted query, join/window explanation, indexing for SQL.
 * - Root cause in Sentence 1, exact fix, prevention for DEBUGGING.
 * - Architectural trade-offs, scaling, failure modes for SYSTEM_DESIGN & ML_DESIGN.
 * - Grounded STAR narrative with context; scaffold placeholders without context.
 * - Screen: Direct answer to visible challenge, visual evidence, no UI chrome description.
 * - Continuation: Seamless continuation without restarting.
 * - Factual persona: Do NOT hardcode "senior" unless candidate profile specifies it.
 * ============================================================================
 */

export interface BasePromptParams {
  experienceLevel?: string;
  jobTitle?: string;
  company?: string;
  interviewRound?: string;
}

export interface TaskStrategyOptions {
  hasCandidateExperience?: boolean;
  hasCompanyContext?: boolean;
}

export interface SessionContextData {
  sessionId?: string;
  session_id?: string;
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

/**
 * 1. Base Interview Prompt Module (Mandatory Correction 5: Factual persona)
 */
export function buildBaseInterviewPrompt(params: BasePromptParams): string {
  const rawLevel = params.experienceLevel?.trim();
  const levelPart = rawLevel && rawLevel.length > 0 ? `${rawLevel} ` : "";
  const rolePart = params.jobTitle?.trim() || "Software Engineer";
  const companyPart = params.company?.trim() ? ` at ${params.company.trim()}` : "";
  const roundPart = params.interviewRound?.trim() ? ` (${params.interviewRound.trim()} round)` : "";

  return `You are the candidate in a live job interview for a ${levelPart}${rolePart}${companyPart}${roundPart}.
Answer in real time. Communicate with clarity, confidence, poise, and sound engineering judgment.

CORE ANSWER RULES:
1. DIRECT ANSWER FIRST: Sentence 1 must state the core answer directly. Never stall, evade, or open with filler ("That's a great question", "In today's fast-paced world", "Sure", "Let me think").
2. SPOKEN ARTICULATION: Speak naturally in first person ("I", "my") as if answering aloud in a live conversation. Keep delivery concise, professional, and crisp.
3. STRICT ANTI-FABRICATION (NON-NEGOTIABLE):
   - Ground all personal claims strictly in the provided resume, verified facts, and context.
   - NEVER invent employers, project achievements, production incidents, metrics, percentages, team sizes, degrees, or certifications.
   - If candidate background is not provided, speak to general engineering principles or provide bracketed scaffolds (e.g., "[Replace with your incident, such as a database pool exhaustion]") without claiming personal experience.
4. PRIOR CONTEXT RECALL: When asked about earlier questions or discussion history, accurately cite the conversation dialogue provided below.
5. STT ROBUSTNESS: Audio transcripts may have phonetic slips (e.g., 'sink' for 'sync', 'py torch' for 'PyTorch'). Answer the intended technical concept directly without commenting on transcript errors.`;
}

/**
 * 2. Task-Specific Strategy Modules (Composable & Redundancy-Free)
 */
export function getModularTaskStrategy(
  taskType?: string,
  parentTaskType?: string,
  requiresCode?: boolean,
  options?: TaskStrategyOptions
): string {
  const effectiveType = taskType === "FOLLOW_UP" && parentTaskType ? parentTaskType : taskType;

  switch (effectiveType) {
    case "CODING":
      return `TASK STRATEGY — CODING:
- Approach: In 1-2 sentences, state your algorithm, chosen data structure, and reasoning.
- Implementation: Provide clean, optimal, production-ready runnable code with concise comments. Do not output pseudocode.
- Complexity: State exact Big-O Time and Space Complexity.
- Edge Cases: Explicitly account for 2-3 specific edge cases (e.g. empty collection, boundary limits, duplicates).
- Focus: Solve the exact problem asked. Keep verbal explanation crisp.`;

    case "SQL":
      return `TASK STRATEGY — SQL:
- Query: Provide the clean, formatted SQL query immediately.
- Explanation: In 1-2 conversational sentences, explain joins, window functions, CTEs, or aggregations.
- Performance: Mention indexing or query plan considerations when relevant. Preserve schema entities from context.`;

    case "DEBUGGING":
      return `TASK STRATEGY — DEBUGGING:
- Root Cause: Sentence 1 states the exact root cause of the bug or exception directly.
- Mechanism: Explain why the error occurs in 1-2 sentences.
- Fix: Provide the exact corrected code snippet.
- Prevention: In 1 sentence, explain how to defensively prevent this in production (e.g., bounds check, input validation, type narrowing).`;

    case "CONCEPTUAL":
    case "THEORETICAL_CONCEPT":
      return `TASK STRATEGY — CONCEPTUAL:
- Definition: Sentence 1 defines the concept or answers the core question directly.
- Under the Hood: In 1-2 sentences, explain the internal mechanism (memory layout, execution model, protocol).
- Trade-off / Example: Provide a concrete engineering trade-off or practical real-world scenario.
- Constraints: Keep tight (~3-5 sentences total). NO CODE unless explicitly requested.`;

    case "COMPARISON":
      return `TASK STRATEGY — TECHNICAL COMPARISON:
- Direct Verdict: Sentence 1 summarizes the fundamental difference or when to choose which.
- Dimensions: Compare across 2-3 key dimensions (latency/throughput, operational overhead, complexity).
- Recommendation: State concrete practical guidelines on when to use A vs B.`;

    case "ML":
    case "ML_DESIGN":
      return `TASK STRATEGY — ML SYSTEM DESIGN:
- Problem & Target: Sentence 1 states mathematical formulation (objective, loss, target) and business metric.
- Data & Features: Outline key features and explicitly state how data leakage is prevented (e.g. time-based split).
- Model Rationale: State baseline vs primary chosen model with concrete latency/scale trade-off rationale.
- Evaluation: Contrast offline metrics (AUC-PR, MAE) with online business A/B metrics.
- Serving & Drift: Detail inference SLA, caching/feature store, and drift monitoring.
- Strict Constraint: Architectural system design only. DO NOT write training code or Python scripts.`;

    case "SYSTEM_DESIGN":
      return `TASK STRATEGY — SYSTEM DESIGN:
- Scope & Assumptions: Frame scale assumptions clearly as interview assumptions (e.g., "Assuming ~50K QPS and 100ms SLA..."). Never claim invented scale numbers as personal production facts.
- Architecture & Flow: Walk through request lifecycle (Client -> CDN/LB -> Gateway -> Services -> Cache -> Database).
- Component Justification: Justify key technology choices with concrete trade-offs (e.g., caching, messaging).
- Resiliency & Trade-offs: Address bottlenecks, failure modes, replication/sharding, CAP trade-offs, and observability.
- Strict Constraint: Architectural reasoning only. DO NOT write application code.`;

    case "CASE_STUDY":
      return `TASK STRATEGY — CASE STUDY:
- Objective: Sentence 1 clarifies target metric, boundary constraints, and scope.
- Structured Approach: Objectives -> Assumptions -> Analysis & Trade-offs -> Action Plan -> Risks.
- Decision Rationale: Articulate why the chosen path maximizes the target metric while mitigating risk.
- Strict Constraint: Focus on engineering strategy and trade-offs. No unnecessary code.`;

    case "BEHAVIORAL": {
      const hasExp = options?.hasCandidateExperience ?? false;
      if (!hasExp) {
        return `TASK STRATEGY — BEHAVIORAL (NO CANDIDATE BACKGROUND PROVIDED):
- Scaffold Mode: Deliver a spoken answer guide with explicit bracketed placeholders: "[Replace with your specific incident, e.g., cache stampede or connection pool exhaustion]".
- Absolute Prohibition: You MUST NOT invent a personal story, incident, or production outage ("I led...", "I resolved...", "At my previous company...").
- Anti-Fabrication: NEVER invent personal metrics, percentages, latency numbers, cost savings, or company names. Focus on qualitative impact.
- Structure: Context -> Personal Action -> Outcome -> Reflection. No literal "Situation/Task/Action/Result" headers.`;
      }
      return `TASK STRATEGY — BEHAVIORAL:
- Spoken Storytelling: First-person ("I") narrative grounded strictly in candidate's authentic background provided below.
- Personal Agency: Focus on what YOU individually decided and did ("I organized...", "I identified...").
- Outcome & Learning: Describe concrete qualitative outcome and close with 1 sentence reflecting on what you learned.
- Formatting: No literal "Situation/Task/Action/Result" headers. Speak naturally as if answering aloud.
- Anti-Fabrication: NEVER invent metrics, percentages, latency numbers, or achievements not in context.`;
    }

    case "HR": {
      const hasComp = options?.hasCompanyContext ?? false;
      if (!hasComp) {
        return `TASK STRATEGY — HR & CULTURE FIT:
- Direct Answer: Sentence 1 answers directly (motivation, notice period, compensation, career goals).
- Transferable Values: Speak to transferable engineering values, collaboration principles, and industry best practices.
- Anti-Fabrication: DO NOT invent company-specific details, internal teams, or private company culture.
- Authentic: Professional, genuine enthusiasm, no sycophancy or generic corporate fluff (3-4 sentences total).`;
      }
      return `TASK STRATEGY — HR & CULTURE FIT:
- Direct Answer: Sentence 1 answers directly (motivation, notice period, compensation, career goals).
- Alignment: Truthfully connect your background with the target company and role engineering challenges.
- Authentic: Genuine enthusiasm and professional clarity without corporate platitudes (3-4 sentences total).`;
    }

    case "MCQ":
      return `TASK STRATEGY — MCQ:
- Option First: Sentence 1 states the correct option letter and text immediately.
- Crisp Rationale: 1-2 crisp sentences explaining why it is correct and why the primary distractor fails.
- Length: Under 40 words total.`;

    case "RESUME_DRILLDOWN":
      return `TASK STRATEGY — RESUME DRILLDOWN:
- Direct Project Anchor: Sentence 1 directly anchors the specific project, architecture, or tool asked about.
- Technical Justification: Explain the exact architectural choices and trade-offs using provided resume facts.
- Strict Truthfulness: Reference only established project details; never invent metrics or technologies.`;

    case "FOLLOW_UP":
      return `TASK STRATEGY — FOLLOW-UP:
- Direct Answer: Sentence 1 directly answers the specific follow-up.
- Leverage Thread: Build upon established decisions and discussion thread without repeating prior explanations.
- Grounded: Reference only facts and technologies established in context; no unanchored claims.`;

    default:
      return `TASK STRATEGY — GENERAL TECHNICAL:
- Direct Answer: Sentence 1 answers the core question directly.
- Depth & Trade-offs: Clear technical rationale with a concrete trade-off or practical example (~30-60 seconds spoken).`;
  }
}

/**
 * 3. Screen Analysis Module (Mandatory Correction 3: Backend Authoritative)
 */
export function buildScreenAnalysisPrompt(userQuestion?: string | null): string {
  const hasUserQ = userQuestion && userQuestion.trim().length > 0 &&
    !userQuestion.toLowerCase().includes('you are an expert technical interview co-pilot');

  const customQPart = hasUserQ
    ? `\nSPECIFIC USER QUESTION: "${userQuestion!.trim()}"\n`
    : "";

  return `TASK: LIVE SCREEN ANALYSIS (SINGLE PASS):
1. EXAMINE SCREEN: Identify the visible challenge (coding problem, SQL query, ML/system design, MCQ, debugging trace, or conceptual question).${customQPart}
2. DIRECT SOLUTION FIRST: Provide the immediate, actionable solution, correct MCQ option, or optimal code immediately.
3. VISUAL EVIDENCE: Use visible code snippets, constraints, and problem text directly from screen.
4. STRICT RULES:
   - DO NOT describe the screenshot, IDE layout, window chrome, or say "In this screenshot...".
   - If ML or System Design: Provide structured architectural reasoning and trade-offs. DO NOT write code!
   - If Coding: 1-2 sentence approach, complete runnable code in requested language, Big-O complexity, edge cases.
   - If SQL: Formatted query first, join/aggregation logic, index considerations.
   - If MCQ: Correct option letter/text in sentence 1, 1-2 sentence explanation. Under 40 words.
   - If Debugging: Exact root cause in sentence 1, corrected code fix, defensive tip.
   - If Conceptual: Direct definition in sentence 1, mechanism, trade-off. No code.`;
}

/**
 * 4. Continuation Module
 */
export function buildContinuationPrompt(): string {
  return "Continue from where the previous answer stopped. Complete unfinished code or sentences without repeating previous text. Return only the continuation.";
}

/**
 * 5. Compact Context Formatting (Consumes Task 6 Selected Context without Bloat)
 */
export function formatBoundedContextCompact(boundedContext?: any): string {
  if (!boundedContext) return "";
  const parts: string[] = [];

  if (boundedContext.activeThread) {
    let threadStr = `THREAD: ${boundedContext.activeThread.parentTopic} (${boundedContext.activeThread.taskType})`;
    if (boundedContext.activeThread.decisions?.length > 0) {
      threadStr += ` | DECISIONS: ${boundedContext.activeThread.decisions.join("; ")}`;
    }
    parts.push(threadStr);
  }

  if (boundedContext.screenObservation) {
    let screenStr = `SCREEN PROBLEM: "${boundedContext.screenObservation.problem}"`;
    if (boundedContext.screenObservation.entities?.length > 0) {
      screenStr += ` | CONSTRAINTS: ${boundedContext.screenObservation.entities.join(", ")}`;
    }
    if (boundedContext.screenObservation.codeSnippet) {
      screenStr += `\nSCREEN CODE:\n${boundedContext.screenObservation.codeSnippet}`;
    }
    parts.push(screenStr);
  }

  if (boundedContext.recentTurns?.length > 0) {
    const dialog = boundedContext.recentTurns
      .map((t: any) => {
        let spk = "Interviewer";
        if (t.speaker === "candidate") spk = "Candidate";
        else if (t.speaker === "meoow") spk = "Meoow";
        return `${spk}: ${t.text}`;
      })
      .join("\n");
    parts.push(`RECENT DIALOGUE:\n${dialog}`);
  }

  if (boundedContext.stableFacts?.length > 0) {
    parts.push(`STABLE FACTS: ${boundedContext.stableFacts.join("; ")}`);
  }

  if (boundedContext.resumeContext) {
    parts.push(`RELEVANT CANDIDATE BACKGROUND: ${boundedContext.resumeContext}`);
  }

  if (boundedContext.candidateProfile) {
    const p = boundedContext.candidateProfile;
    parts.push(`CANDIDATE: ${p.level || ""} ${p.role || ""} | SKILLS: ${p.skills?.join(", ") || "General"}`);
  }

  return parts.length > 0
    ? `\n\n[BOUNDED CONTEXT]\n${parts.join("\n\n")}\n`
    : "";
}

/**
 * 6. Master Compressed System Prompt Builder
 */
export function buildCompressedSystemPrompt(
  context?: SessionContextData,
  taskMetadata?: TaskMetadata
): string {
  const jobTitle = context?.jobTitle || context?.job_title || "Software Engineer";
  const company = context?.company?.trim() || "";
  const experienceLevel = context?.experienceLevel || context?.experience_level || "";
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
    company.length > 1 &&
    !/^(unknown|target company|n\/a|none)$/i.test(company)
  );

  const basePrompt = buildBaseInterviewPrompt({
    experienceLevel,
    jobTitle,
    company,
    interviewRound,
  });

  const taskStrategy = getModularTaskStrategy(
    effectiveTaskType,
    effectiveParentTaskType,
    requiresCode,
    { hasCandidateExperience, hasCompanyContext }
  );

  const contextBlock = formatBoundedContextCompact(boundedContext);

  let fullPrompt = `${basePrompt}

CURRENT TASK: ${effectiveTaskType}${effectiveParentTaskType ? ` (Follow-up to ${effectiveParentTaskType})` : ""}
${taskStrategy}${contextBlock}`;

  if (context) {
    const resume = context.resumeText || context.resume_text;
    const isPureTechnicalTask =
      effectiveTaskType === "CODING" ||
      effectiveTaskType === "SQL" ||
      effectiveTaskType === "MCQ";
    const hasSelectedResume = Boolean(boundedContext?.resumeContext);

    if (resume && !isPureTechnicalTask && !hasSelectedResume) {
      fullPrompt += `\nCANDIDATE BACKGROUND (authentic; never invent beyond this):\n${resume.slice(0, 2000)}\n`;
    }
    if (context.notes) {
      fullPrompt += `\nINTERVIEW FOCUS NOTES:\n${context.notes.slice(0, 800)}\n`;
    }
  }

  return fullPrompt.trim();
}

/**
 * 7. Token estimation helper (~4 chars per token average)
 */
export function estimatePromptTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
