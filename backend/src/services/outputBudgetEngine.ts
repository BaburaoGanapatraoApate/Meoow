/**
 * ============================================================================
 * OUTPUT BUDGET ENGINE (CANONICAL IMPLEMENTATION)
 * ============================================================================
 * Task 8: Task-Specific Dynamic Output Budgets.
 *
 * Target Architecture:
 *   effectiveMaxTokens = min(taskResolvedMaxTokens, applicationMaxOutputTokens, providerMaxOutputTokens)
 *
 * Invariants:
 * - Match output length to task complexity without arbitrary gutting.
 * - Completeness-first: Never truncate valid code, SQL, debugging, or system design.
 * - Separation of concerns: Task budget vs Application cap vs Provider maximum.
 * - Explicit ceilingLimited visibility when application caps constrain task budgets.
 * - Layered lexical truncation detection (zero false positives on braces in strings/comments).
 * - Bounded, evidence-based single continuation (maxContinuationAttempts = 1).
 * - Credit accounting invariant: 1 logical answer = 1 logical credit.
 * - Zero model switching or call elimination (Task 9+ strictly preserved).
 * ============================================================================
 */

import { MODEL_REGISTRY } from "./groqService";

export interface TaskOutputProfile {
  taskType: string;
  minTokens: number;
  targetTokens: number;
  maxTokens: number;
  allowDynamicExpansion: boolean;
  description: string;
}

/**
 * 1. Centralized Output-Budget Profiles Registry
 */
export const TASK_OUTPUT_PROFILES: Record<string, TaskOutputProfile> = {
  MCQ: {
    taskType: 'MCQ',
    minTokens: 120,
    targetTokens: 200,
    maxTokens: 300,
    allowDynamicExpansion: true,
    description: 'Option letter/text and concise rationale under 40 words',
  },
  CONCEPTUAL: {
    taskType: 'CONCEPTUAL',
    minTokens: 220,
    targetTokens: 375,
    maxTokens: 500,
    allowDynamicExpansion: true,
    description: 'Crisp definition, internal mechanism, and concrete trade-off',
  },
  THEORETICAL_CONCEPT: {
    taskType: 'THEORETICAL_CONCEPT',
    minTokens: 220,
    targetTokens: 375,
    maxTokens: 500,
    allowDynamicExpansion: true,
    description: 'Theoretical foundation and engineering mechanism',
  },
  GENERAL_TECHNICAL: {
    taskType: 'GENERAL_TECHNICAL',
    minTokens: 250,
    targetTokens: 450,
    maxTokens: 650,
    allowDynamicExpansion: true,
    description: 'General technical interview response with trade-off analysis',
  },
  CLARIFICATION: {
    taskType: 'CLARIFICATION',
    minTokens: 200,
    targetTokens: 350,
    maxTokens: 500,
    allowDynamicExpansion: false,
    description: 'Clarifying question or conversational check',
  },
  COMPARISON: {
    taskType: 'COMPARISON',
    minTokens: 250,
    targetTokens: 450,
    maxTokens: 650,
    allowDynamicExpansion: true,
    description: '2-3 dimension technical comparison with concrete verdict',
  },
  BEHAVIORAL: {
    taskType: 'BEHAVIORAL',
    minTokens: 300,
    targetTokens: 500,
    maxTokens: 700,
    allowDynamicExpansion: true,
    description: 'Grounded first-person STAR story or bracketed scaffold guide',
  },
  HR: {
    taskType: 'HR',
    minTokens: 250,
    targetTokens: 400,
    maxTokens: 600,
    allowDynamicExpansion: true,
    description: 'Direct answer to HR/cultural alignment and career goals',
  },
  SQL: {
    taskType: 'SQL',
    minTokens: 250,
    targetTokens: 450,
    maxTokens: 650,
    allowDynamicExpansion: true,
    description: 'Formatted query, join/window explanation, indexing rationale',
  },
  DEBUGGING: {
    taskType: 'DEBUGGING',
    minTokens: 300,
    targetTokens: 550,
    maxTokens: 800,
    allowDynamicExpansion: true,
    description: 'Sentence 1 root cause, mechanism, fix code, and prevention',
  },
  CODING: {
    taskType: 'CODING',
    minTokens: 350,
    targetTokens: 500,
    maxTokens: 1000,
    allowDynamicExpansion: true,
    description: 'Complete runnable optimal code, Big-O complexity, edge cases',
  },
  CASE_STUDY: {
    taskType: 'CASE_STUDY',
    minTokens: 500,
    targetTokens: 800,
    maxTokens: 1200,
    allowDynamicExpansion: true,
    description: 'Structured business/engineering scenario analysis and trade-offs',
  },
  PRODUCT_SCENARIO: {
    taskType: 'PRODUCT_SCENARIO',
    minTokens: 500,
    targetTokens: 800,
    maxTokens: 1200,
    allowDynamicExpansion: true,
    description: 'Product architecture and trade-off scenario',
  },
  SYSTEM_DESIGN: {
    taskType: 'SYSTEM_DESIGN',
    minTokens: 600,
    targetTokens: 900,
    maxTokens: 1300,
    allowDynamicExpansion: true,
    description: 'Distributed architecture, request flow, failure modes, CAP trade-offs',
  },
  ML_DESIGN: {
    taskType: 'ML_DESIGN',
    minTokens: 650,
    targetTokens: 950,
    maxTokens: 1400,
    allowDynamicExpansion: true,
    description: 'ML problem formulation, data leakage, baseline vs primary model, drift',
  },
  ML: {
    taskType: 'ML',
    minTokens: 650,
    targetTokens: 950,
    maxTokens: 1400,
    allowDynamicExpansion: true,
    description: 'Machine learning technical concepts and architecture',
  },
  RESUME_DRILLDOWN: {
    taskType: 'RESUME_DRILLDOWN',
    minTokens: 250,
    targetTokens: 450,
    maxTokens: 700,
    allowDynamicExpansion: true,
    description: 'Anchored project details, technical justification, zero fabrication',
  },
  CONTINUATION: {
    taskType: 'CONTINUATION',
    minTokens: 150,
    targetTokens: 350,
    maxTokens: 600,
    allowDynamicExpansion: true,
    description: 'Bounded completion of unfinished answer without restart',
  },
};

/**
 * Provider hardware/model ceilings (separate from Meoow application caps).
 */
export const PROVIDER_HARDWARE_MAX_TOKENS: Record<string, number> = {
  "qwen/qwen3.8-27b": 16384,
  "openai/gpt-oss-120b": 65536,
  "openai/gpt-oss-20b": 65536,
  "groq/compound-mini": 16384,
  "groq/compound": 16384,
  "default": 16384,
};

export interface ResolveOutputBudgetOptions {
  taskType?: string;
  parentTaskType?: string;
  suggestedDepth?: 'SHORT' | 'NORMAL' | 'DEEP';
  requiresCode?: boolean;
  question?: string;
  sessionContext?: any;
  taskMetadata?: any;
  model?: string;
  isContinuation?: boolean;
  previousAnswer?: string;
  isScreen?: boolean;
  clientMaxTokens?: number;
}

export interface OutputBudgetResult {
  taskType: string;
  targetTokens: number;
  minimumTokens: number;
  taskMaximumTokens: number;
  taskResolvedMaxTokens: number;
  applicationMaximumTokens: number;
  providerMaximumTokens: number;
  effectiveMaxTokens: number;
  ceilingLimited: boolean;
  complexityLevel: 'LOW' | 'NORMAL' | 'HIGH';
  complexityFactors: string[];
  continuationAllowed: boolean;
}

/**
 * Deterministically deduce screen task type from question, metadata, and observations.
 */
export function deduceScreenTaskType(
  explicitTaskType?: string,
  question?: string,
  screenObservation?: any
): string {
  if (explicitTaskType && explicitTaskType !== 'GENERAL_TECHNICAL' && TASK_OUTPUT_PROFILES[explicitTaskType]) {
    return explicitTaskType;
  }

  const textToScan = [
    question || '',
    screenObservation?.problem || '',
    screenObservation?.primaryQuestionOrProblem || '',
    ...(screenObservation?.entities || []),
  ].join(' ').toLowerCase();

  // 1. MCQ
  if (
    /\b(?:multiple\s*choice|mcq|which\s+(?:of\s+the\s+following|option|statement)|select\s+(?:one|the\s+correct))\b/i.test(textToScan) ||
    /\b(?:option\s+[a-d]\b|\([a-d]\)\s+[a-z])/i.test(textToScan)
  ) {
    return 'MCQ';
  }

  // 2. SQL
  if (/\b(?:sql|query|select\s+.+\s+from|join|group\s+by|having|window\s+function|second\s+highest)\b/i.test(textToScan)) {
    return 'SQL';
  }

  // 3. DEBUGGING
  if (/\b(?:\w*error|\w*exception|uncaught|traceback|stack\s*trace|bug|fix\s+this|segmentation\s+fault|nullpointer)\b/i.test(textToScan)) {
    return 'DEBUGGING';
  }

  // 4. CODING
  if (
    /\b(?:leetcode|write\s+(?:a\s+)?function|implement\s+(?:a\s+)?(?:function|class|method|solution)|two\s*sum|binary\s*tree|linked\s*list|dynamic\s*programming|array|dp\b|time\s*complexity)\b/i.test(textToScan) ||
    screenObservation?.codeSnippet
  ) {
    return 'CODING';
  }

  // 5. ML DESIGN
  if (/\b(?:machine\s*learning|ml\s*system|recommendation\s*system|eta\s*prediction|data\s*leakage|loss\s*function|auc|feature\s*store)\b/i.test(textToScan)) {
    return 'ML_DESIGN';
  }

  // 6. SYSTEM DESIGN
  if (/\b(?:system\s*design|design\s+(?:a\s+)?(?:url\s*shortener|twitter|uber|cache|rate\s*limiter)|qps|throughput|load\s*balancer|microservices|distributed)\b/i.test(textToScan)) {
    return 'SYSTEM_DESIGN';
  }

  // 7. CASE STUDY
  if (/\b(?:case\s*study|incident|outage|latency\s*spike|root\s*cause\s*analysis|post-?mortem)\b/i.test(textToScan)) {
    return 'CASE_STUDY';
  }

  return 'GENERAL_TECHNICAL';
}

/**
 * 2. Deterministic Output Budget Resolver
 * Calculates taskResolvedMaxTokens, respects application & provider caps, and flags ceilingLimited.
 */
export function resolveOutputBudget(options: ResolveOutputBudgetOptions = {}): OutputBudgetResult {
  const complexityFactors: string[] = [];
  let effectiveTaskType: string;

  // 1. Continuation check
  if (options.isContinuation) {
    effectiveTaskType = 'CONTINUATION';
  } else if (options.isScreen) {
    effectiveTaskType = deduceScreenTaskType(
      options.taskMetadata?.taskType || options.taskType,
      options.question,
      options.taskMetadata?.boundedContext?.screenObservation || options.sessionContext?.boundedContext?.screenObservation
    );
    complexityFactors.push(`Screen task deduced: ${effectiveTaskType}`);
  } else if (options.taskType === 'FOLLOW_UP' && options.parentTaskType) {
    effectiveTaskType = options.parentTaskType;
    complexityFactors.push(`Follow-up anchored to parent: ${options.parentTaskType}`);
  } else {
    effectiveTaskType =
      options.taskMetadata?.taskType ||
      options.taskType ||
      options.sessionContext?.taskType ||
      'GENERAL_TECHNICAL';
  }

  const profile = TASK_OUTPUT_PROFILES[effectiveTaskType] || TASK_OUTPUT_PROFILES['GENERAL_TECHNICAL'];
  let computedTokens = profile.targetTokens;
  let complexityLevel: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL';

  const questionText = (options.question || '').trim();

  // 2. Dynamic Complexity Adjustments
  if (effectiveTaskType === 'CONTINUATION') {
    // Continuation budget scaling
    const prevLen = (options.previousAnswer || '').length;
    if (prevLen > 2500) {
      computedTokens = 250;
      complexityFactors.push('Late-stage continuation: bounded to 250 tokens');
    } else if (options.parentTaskType === 'CODING' || options.parentTaskType === 'SYSTEM_DESIGN') {
      computedTokens = 450;
      complexityFactors.push('Technical task continuation: allocated 450 tokens');
    }
  } else {
    // Suggested depth input
    const depth = options.taskMetadata?.suggestedDepth || options.suggestedDepth;
    if (depth === 'SHORT') {
      computedTokens -= Math.round((profile.targetTokens - profile.minTokens) * 0.5);
      complexityLevel = 'LOW';
      complexityFactors.push('Depth SHORT requested (-25%)');
    } else if (depth === 'DEEP') {
      computedTokens += Math.round((profile.maxTokens - profile.targetTokens) * 0.6);
      complexityLevel = 'HIGH';
      complexityFactors.push('Depth DEEP requested (+35%)');
    }

    // Question complexity signals
    if (questionText) {
      // Explanation request on MCQ
      if (effectiveTaskType === 'MCQ' && /\b(?:explain|why|rationale|detail|distractor)\b/i.test(questionText)) {
        computedTokens = Math.min(profile.maxTokens, computedTokens + 80);
        complexityFactors.push('MCQ with explicit explanation requested (+80 tokens)');
      }

      // Multi-subquestion detection
      const hasSubquestions =
        /(?:^|\s)(?:1\.|2\.|part\s+[ab12]|firstly|secondly|and\s+also|both\s+.+\s+and)\b/i.test(questionText) ||
        (questionText.match(/\?/g) || []).length >= 2;

      if (hasSubquestions && profile.allowDynamicExpansion) {
        computedTokens = Math.min(profile.maxTokens, computedTokens + 120);
        complexityLevel = 'HIGH';
        complexityFactors.push('Multiple subquestions detected (+120 tokens)');
      }

      // Advanced coding complexity
      if (
        (effectiveTaskType === 'CODING' || options.requiresCode) &&
        /\b(?:dynamic\s*programming|memoization|bottom\s*up|sliding\s*window|backtracking|graph|dijkstra|topological|trie|concurrent|multithread)\b/i.test(questionText)
      ) {
        computedTokens = Math.min(profile.maxTokens, computedTokens + 250);
        complexityLevel = 'HIGH';
        complexityFactors.push('Advanced algorithmic complexity (+250 tokens)');
      }

      // Production scale signals in System Design / ML Design
      if (
        (effectiveTaskType === 'SYSTEM_DESIGN' || effectiveTaskType === 'ML_DESIGN') &&
        /\b(?:50k|100k|million|billion|qps|rps|tps|multi-region|active-active|failover|sharding|partition|feature\s*store|drift\s*detection)\b/i.test(questionText)
      ) {
        computedTokens = Math.min(profile.maxTokens, computedTokens + 300);
        complexityLevel = 'HIGH';
        complexityFactors.push('High-scale production architecture (+300 tokens)');
      }
    }
  }

  // Clamp within task profile min/max bounds
  const taskResolvedMaxTokens = Math.max(profile.minTokens, Math.min(profile.maxTokens, Math.round(computedTokens)));

  // 3. Ceilings Evaluation
  const targetModel = options.model || "default";
  const appCap = MODEL_REGISTRY[targetModel]?.maxOutputTokens ?? 1024;
  const applicationMaximumTokens = appCap;
  const providerMaximumTokens = PROVIDER_HARDWARE_MAX_TOKENS[targetModel] || PROVIDER_HARDWARE_MAX_TOKENS["default"];

  // Effective maximum is the minimum of taskResolved, applicationMax, and providerMax
  let effectiveMaxTokens = Math.min(taskResolvedMaxTokens, applicationMaximumTokens, providerMaximumTokens);

  // If explicit clientMaxTokens is provided, it can further constrain
  if (options.clientMaxTokens && options.clientMaxTokens > 0) {
    effectiveMaxTokens = Math.min(effectiveMaxTokens, options.clientMaxTokens);
  }

  // Ceiling limited visibility
  const ceilingLimited = taskResolvedMaxTokens > effectiveMaxTokens;

  return {
    taskType: effectiveTaskType,
    targetTokens: profile.targetTokens,
    minimumTokens: profile.minTokens,
    taskMaximumTokens: profile.maxTokens,
    taskResolvedMaxTokens,
    applicationMaximumTokens,
    providerMaximumTokens,
    effectiveMaxTokens,
    ceilingLimited,
    complexityLevel,
    complexityFactors,
    continuationAllowed: effectiveTaskType !== 'CONTINUATION',
  };
}

/**
 * 3. Safe Truncation Detection (Correction 3: Lexical Scanner, Zero False Positives)
 */
export interface TruncationAnalysis {
  likelyTruncated: boolean;
  finishReasonLength: boolean;
  hasUnclosedCodeBlock: boolean;
  hasUnmatchedBracesInCode: boolean;
  hasIncompleteSentence: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'NONE';
  reason?: string;
}

export function detectLikelyTruncation(
  answer: string,
  finishReason?: string
): TruncationAnalysis {
  const isLength = finishReason === 'length';
  const trimmed = (answer || '').trim();

  if (!trimmed) {
    return {
      likelyTruncated: false,
      finishReasonLength: isLength,
      hasUnclosedCodeBlock: false,
      hasUnmatchedBracesInCode: false,
      hasIncompleteSentence: false,
      confidence: 'NONE',
    };
  }

  // 1. Incomplete fenced code blocks (odd number of ``` fences)
  const fenceMatches = trimmed.match(/^```/gm) || [];
  const hasUnclosedCodeBlock = fenceMatches.length % 2 !== 0;

  // 2. Lexical structural scanner: count unclosed braces ONLY outside strings, comments, and regexes
  let hasUnmatchedBracesInCode = false;
  if (hasUnclosedCodeBlock) {
    // Find the last code block content
    const lastFenceIdx = trimmed.lastIndexOf('```');
    const codeSnippet = trimmed.slice(lastFenceIdx + 3);

    let braceDepth = 0;
    let parenDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let inLineComment = false;
    let inBlockComment = false;
    let isEscaped = false;

    for (let i = 0; i < codeSnippet.length; i++) {
      const ch = codeSnippet[i];
      const next = codeSnippet[i + 1];

      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (ch === '\\') {
        isEscaped = true;
        continue;
      }

      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      if (inSingleQuote) {
        if (ch === "'") inSingleQuote = false;
        continue;
      }
      if (inDoubleQuote) {
        if (ch === '"') inDoubleQuote = false;
        continue;
      }
      if (inBacktick) {
        if (ch === '`') inBacktick = false;
        continue;
      }

      // Check entering comments
      if (ch === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }

      // Check entering strings
      if (ch === "'") { inSingleQuote = true; continue; }
      if (ch === '"') { inDoubleQuote = true; continue; }
      if (ch === '`') { inBacktick = true; continue; }

      // Structural braces outside literals/comments
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
      else if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    }

    if (braceDepth > 0 || parenDepth > 0) {
      hasUnmatchedBracesInCode = true;
    }
  }

  // 3. Mid-sentence truncation check
  const lastChar = trimmed.slice(-1);
  const validTerminators = new Set(['.', '!', '?', '}', ';', '`', ')', '>', ':', '"', "'"]);
  const hasIncompleteSentence = !validTerminators.has(lastChar) && !trimmed.endsWith('```');

  // 4. Combined layered evaluation (Correction 3: never rely on brace count alone)
  let likelyTruncated = false;
  let confidence: 'HIGH' | 'MEDIUM' | 'NONE' = 'NONE';
  let reason: string | undefined;

  if (isLength) {
    likelyTruncated = true;
    confidence = 'HIGH';
    reason = 'Provider reported finish_reason=length';
  } else if (hasUnclosedCodeBlock && hasUnmatchedBracesInCode) {
    likelyTruncated = true;
    confidence = 'HIGH';
    reason = 'Unclosed code block with active unmatched syntax braces';
  } else if (hasUnclosedCodeBlock) {
    likelyTruncated = true;
    confidence = 'MEDIUM';
    reason = 'Unclosed code block fence at end of stream';
  } else if (hasIncompleteSentence && trimmed.length > 100) {
    // Only flag if answer ends abruptly on an unfinished sentence in a response
    const lastWord = trimmed.split(/\s+/).pop() || '';
    const isAbruptWord = /^[a-zA-Z]{1,10}$/.test(lastWord) && !['etc', 'eg', 'ie'].includes(lastWord.toLowerCase());
    if (isAbruptWord) {
      likelyTruncated = true;
      confidence = 'MEDIUM';
      reason = 'Abrupt word cutoff at end of response';
    }
  }

  return {
    likelyTruncated,
    finishReasonLength: isLength,
    hasUnclosedCodeBlock,
    hasUnmatchedBracesInCode,
    hasIncompleteSentence,
    confidence,
    reason,
  };
}

/**
 * 4. Bounded Continuation Gate (Correction 4)
 */
export function shouldTriggerContinuation(params: {
  answer: string;
  finishReason?: string;
  isContinuation?: boolean;
  hasContinued?: boolean;
}): boolean {
  // Hard limit: max 1 continuation per logical answer
  if (params.isContinuation || params.hasContinued) {
    return false;
  }

  const analysis = detectLikelyTruncation(params.answer, params.finishReason);
  if (!analysis.likelyTruncated) {
    return false;
  }

  // Meaningful content requirement: must have streamed at least basic initial content
  if (!params.answer || params.answer.trim().length < 40) {
    return false;
  }

  return true;
}
