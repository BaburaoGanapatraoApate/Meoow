/**
 * ============================================================================
 * INTELLIGENT CONTEXT SELECTION ENGINE (CANONICAL IMPLEMENTATION)
 * ============================================================================
 * Deterministic, relevance-aware interview context selection system.
 *
 * Target Structure:
 *   CURRENT QUESTION + ACTIVE THREAD + RELEVANT PRIOR TURNS +
 *   RELEVANT STABLE FACTS + RELEVANT RESUME FACTS +
 *   LATEST RELEVANT SCREEN OBSERVATION + TASK METADATA
 *
 * Guarantees:
 * - Minimum context required for correct answering
 * - Previous-question recall and follow-up continuity
 * - Zero transcript persistence
 * - Server authority over context identity
 * - Request-specific relevance overriding global hierarchy
 * - Hard retention rules before relevance scoring
 * - Strict parity across frontend and backend
 * ============================================================================
 */

// ─── 1. Context Information Classes (Phase 2) ───

export type ContextCategory =
  | 'CURRENT_QUESTION'
  | 'ACTIVE_THREAD'
  | 'RELEVANT_PRIOR_TURN'
  | 'STABLE_FACT'
  | 'RESUME_FACT'
  | 'SCREEN_OBSERVATION'
  | 'TASK_METADATA'
  | 'CONTINUATION_CONTEXT';

export type RequestType =
  | 'TEXT_CHAT'
  | 'CONTINUATION'
  | 'SCREEN'
  | 'RESUME_DRILLDOWN'
  | 'MCQ'
  | 'CODING'
  | 'SQL'
  | 'CONCEPTUAL'
  | 'BEHAVIORAL'
  | 'ML_DESIGN'
  | 'SYSTEM_DESIGN'
  | 'CASE_STUDY';

export type TaskType =
  | 'CODING'
  | 'SQL'
  | 'DEBUGGING'
  | 'CONCEPTUAL'
  | 'THEORETICAL_CONCEPT'
  | 'CASE_STUDY'
  | 'SYSTEM_DESIGN'
  | 'ML_DESIGN'
  | 'MCQ'
  | 'BEHAVIORAL'
  | 'HR'
  | 'DATA_INTERPRETATION'
  | 'PRODUCT_SCENARIO'
  | 'GENERAL_TECHNICAL'
  | 'FOLLOW_UP'
  | 'CLARIFICATION'
  | 'COMPARISON'
  | 'RESUME_DRILLDOWN';

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DialogueTurn {
  turnId: string;
  sequenceNumber: number;
  speaker: 'interviewer' | 'candidate' | 'meoow';
  source?: 'audio' | 'screen' | 'manual';
  text: string;
  timestamp: string;
  tokenCount: number;
  threadId?: string;
  taskType?: TaskType;
}
export interface ActiveDiscussionThread {
  threadId: string;
  parentTopic: string;
  taskType: TaskType;
  establishedDecisions: string[];
  lastQuestion: string;
  lastAnswerSummary?: string;
  startedAt: string;
  turnCount: number;
  entities?: string[];
  isClosed?: boolean;
}

export interface CompactScreenObservation {
  observationId: string;
  timestamp: string;
  taskType?: TaskType;
  primaryQuestionOrProblem: string;
  keyEntitiesAndConstraints: string[];
  codeSnippet: string | null;
  tokenCount: number;
  isSuperseded?: boolean;
}

export interface EstablishedFact {
  factId: string;
  category: 'architecture' | 'decision' | 'constraint' | 'candidate_fact';
  fact: string;
  source?: 'candidate' | 'interviewer' | 'verified_resume' | 'explicit_constraint';
  establishedAt: string;
  relatedTopic?: string;
  isSuperseded?: boolean;
}

export interface CandidateFacts {
  jobTitle: string;
  company: string;
  interviewRound: string;
  experienceLevel: string;
  focusNotes?: string;
  keySkills: string[];
  mode: 'PERSONALIZED' | 'GENERAL';
  projects?: Array<{ name: string; description: string; technologies: string[] }>;
}

export interface CurrentContextSlot {
  question: string | null;
  userPrompt: string | null;
  taskType: TaskType | null;
  confidence: number | null;
  latestScreenObservation: CompactScreenObservation | null;
}

export interface InterviewContext {
  sessionId: string;
  contextVersion: number;
  lastSequenceNumber: number;
  activeDiscussionThread: ActiveDiscussionThread | null;
  current: CurrentContextSlot;
  recentTurns: DialogueTurn[];
  stableFacts: EstablishedFact[];
  rollingSummary: string | null;
  candidateFacts: CandidateFacts;
}

export interface BoundedContextPayload {
  contextVersion: number;
  relevantContextSignature: string;
  requestType: RequestType;
  estimatedTokens: number;
  current: {
    question: string | null;
    userPrompt: string | null;
    taskType: TaskType | null;
  };
  activeThread: {
    parentTopic: string;
    taskType: TaskType;
    decisions: string[];
  } | null;
  screenObservation: {
    problem: string;
    entities: string[];
    codeSnippet: string | null;
  } | null;
  recentTurns: Array<{
    speaker: 'interviewer' | 'candidate' | 'meoow';
    source?: 'audio' | 'screen' | 'manual';
    text: string;
    relevanceReason?: string;
  }>;
  stableFacts: string[];
  resumeContext: string | null;
  summary: string | null;
  candidateProfile: {
    role: string;
    level: string;
    skills: string[];
    mode: 'PERSONALIZED' | 'GENERAL';
  };
}

// ─── 2. Approximate Token Estimation (~4 chars/token) ───

export function estimateTokens(text?: string | null): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

// ─── 3. Deterministic Entity & Keyword Extraction ───

export const KNOWN_TECHNICAL_ENTITIES = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  'React', 'Next.js', 'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Spring Boot',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'Elasticsearch', 'DynamoDB', 'Neo4j',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Kafka', 'RabbitMQ', 'GraphQL', 'REST', 'gRPC',
  'PyTorch', 'TensorFlow', 'Scikit-learn', 'LightGBM', 'XGBoost', 'HuggingFace', 'BERT', 'LLM', 'RAG',
  'pgvector', 'Vector Database', 'ChromaDB', 'Pinecone', 'Milvus',
  'System Design', 'Microservices', 'Distributed Systems', 'CI/CD', 'Load Balancer', 'CDN', 'Rate Limiter',
  'Cache Stampede', 'Deadlock', 'Two Sum', 'Linked List', 'Binary Tree', 'Sliding Window', 'Dynamic Programming',
  'Anomaly Detection', 'Fraud Detection', 'Recommendation System', 'Search Engine', 'ETA Prediction',
  'Mockify', 'LeetCode', 'CAP Theorem', 'ACID', 'Sharding', 'Replication'
];

export function extractEntitiesFromText(text?: string | null): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const entity of KNOWN_TECHNICAL_ENTITIES) {
    const regex = new RegExp(`\\b${entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      found.add(entity);
    }
  }
  return Array.from(found);
}

// ─── 4. Follow-up & Pronoun Detection (Mandatory Correction 5) ───

export const FOLLOW_UP_PRONOUNS_REGEX = /\b(it|that|this|they|them|its|these|those)\b/i;

export const FOLLOW_UP_PATTERNS_REGEX =
  /\b(why|how|what about|what was the result|explain further|what happened next|can you give an example|what model|which dataset|what dataset|what data|why did you choose|how did you solve|what performance|what metric|what result|tell me more|continue)\b/i;

export function isFollowUpQuestion(question?: string | null): boolean {
  if (!question || typeof question !== 'string') return false;
  const q = question.trim();
  if (q.length === 0) return false;

  // Phrases referring to screen, image, or code snippet are visual inquiries, not conversational dialogue follow-ups
  if (/\b(this|the)\s+(screen|image|picture|photo|snippet|diagram|slide|code)\b/i.test(q)) {
    return false;
  }

  // Very short questions (< 5 words) like "Why?", "How?", "And then?" are follow-ups
  const words = q.split(/\s+/);
  if (words.length <= 4 && (q.endsWith('?') || FOLLOW_UP_PATTERNS_REGEX.test(q))) {
    return true;
  }

  // Check explicit follow-up stems and pronouns for bounded questions (<= 8 words)
  if (words.length <= 8 && FOLLOW_UP_PRONOUNS_REGEX.test(q)) {
    return true;
  }
  if (words.length <= 8 && FOLLOW_UP_PATTERNS_REGEX.test(q)) {
    return true;
  }

  return false;
}

// ─── 5. Resume Drilldown Detection (Mandatory Correction 3) ───

export function isResumeDrilldownQuestion(question?: string | null): boolean {
  if (!question || typeof question !== 'string') return false;
  const q = question.toLowerCase();
  const drilldownSignals = [
    'project', 'internship', 'experience', 'resume', 'background',
    'why did you choose', 'tell me about your', 'your work at', 'your role in',
    'architecture you built', 'your approach in', 'in your project',
    'mockify', 'anomaly detection', 'rag project', 'what model did you use in'
  ];
  return drilldownSignals.some(s => q.includes(s));
}

// ─── 6. Request-Type Deduction (Mandatory Correction 3) ───

export function deduceRequestType(params: {
  question?: string | null;
  source?: string;
  isContinuation?: boolean;
  hasImage?: boolean;
  taskType?: TaskType | string | null;
}): RequestType {
  if (params.isContinuation) {
    return 'CONTINUATION';
  }

  if (params.hasImage || params.source === 'screen' || params.source === 'screen_capture') {
    return 'SCREEN';
  }

  if (isResumeDrilldownQuestion(params.question) || params.taskType === 'RESUME_DRILLDOWN') {
    return 'RESUME_DRILLDOWN';
  }

  switch (params.taskType) {
    case 'CODING':
    case 'DEBUGGING':
      return 'CODING';
    case 'SQL':
      return 'SQL';
    case 'MCQ':
      return 'MCQ';
    case 'CONCEPTUAL':
    case 'THEORETICAL_CONCEPT':
    case 'COMPARISON':
      return 'CONCEPTUAL';
    case 'BEHAVIORAL':
    case 'HR':
      return 'BEHAVIORAL';
    case 'ML_DESIGN':
      return 'ML_DESIGN';
    case 'SYSTEM_DESIGN':
      return 'SYSTEM_DESIGN';
    case 'CASE_STUDY':
    case 'PRODUCT_SCENARIO':
    case 'DATA_INTERPRETATION':
      return 'CASE_STUDY';
    default:
      return 'TEXT_CHAT';
  }
}

// ─── 7. Request-Type Configuration & Ceilings (Phase 11 & 13) ───

export interface RequestTypeConfig {
  targetTokens: number;
  maxTurns: number;
  maxStableFacts: number;
  maxResumeChars: number;
  maxScreenTokens: number;
  includeScreen: boolean;
  includeResumeDrilldown: boolean;
  includeDecisions: boolean;
}

export const REQUEST_TYPE_CONFIGS: Record<RequestType, RequestTypeConfig> = {
  TEXT_CHAT: {
    targetTokens: 600,
    maxTurns: 4,
    maxStableFacts: 4,
    maxResumeChars: 400,
    maxScreenTokens: 100,
    includeScreen: false,
    includeResumeDrilldown: false,
    includeDecisions: true,
  },
  CONTINUATION: {
    targetTokens: 400,
    maxTurns: 1, // immediate antecedent only
    maxStableFacts: 2,
    maxResumeChars: 0,
    maxScreenTokens: 0,
    includeScreen: false,
    includeResumeDrilldown: false,
    includeDecisions: true,
  },
  SCREEN: {
    targetTokens: 600,
    maxTurns: 2,
    maxStableFacts: 3,
    maxResumeChars: 400,
    maxScreenTokens: 250,
    includeScreen: true, // PRIMARY
    includeResumeDrilldown: false,
    includeDecisions: true,
  },
  RESUME_DRILLDOWN: {
    targetTokens: 650,
    maxTurns: 3,
    maxStableFacts: 5,
    maxResumeChars: 1500, // Detailed project/experience facts
    maxScreenTokens: 0,
    includeScreen: false,
    includeResumeDrilldown: true,
    includeDecisions: true,
  },
  MCQ: {
    targetTokens: 350,
    maxTurns: 1,
    maxStableFacts: 2,
    maxResumeChars: 0,
    maxScreenTokens: 150,
    includeScreen: true,
    includeResumeDrilldown: false,
    includeDecisions: false,
  },
  CODING: {
    targetTokens: 500,
    maxTurns: 2,
    maxStableFacts: 2,
    maxResumeChars: 0, // suppress raw resume
    maxScreenTokens: 150,
    includeScreen: true,
    includeResumeDrilldown: false,
    includeDecisions: false,
  },
  SQL: {
    targetTokens: 500,
    maxTurns: 2,
    maxStableFacts: 3, // schema facts
    maxResumeChars: 0,
    maxScreenTokens: 100,
    includeScreen: true,
    includeResumeDrilldown: false,
    includeDecisions: false,
  },
  CONCEPTUAL: {
    targetTokens: 450,
    maxTurns: 2,
    maxStableFacts: 2,
    maxResumeChars: 0,
    maxScreenTokens: 0,
    includeScreen: false,
    includeResumeDrilldown: false,
    includeDecisions: false,
  },
  BEHAVIORAL: {
    targetTokens: 600,
    maxTurns: 3,
    maxStableFacts: 4,
    maxResumeChars: 800,
    maxScreenTokens: 0,
    includeScreen: false,
    includeResumeDrilldown: true,
    includeDecisions: false,
  },
  ML_DESIGN: {
    targetTokens: 750,
    maxTurns: 4,
    maxStableFacts: 5,
    maxResumeChars: 400,
    maxScreenTokens: 150,
    includeScreen: true,
    includeResumeDrilldown: false,
    includeDecisions: true,
  },
  SYSTEM_DESIGN: {
    targetTokens: 750,
    maxTurns: 4,
    maxStableFacts: 5,
    maxResumeChars: 400,
    maxScreenTokens: 150,
    includeScreen: true,
    includeResumeDrilldown: false,
    includeDecisions: true,
  },
  CASE_STUDY: {
    targetTokens: 650,
    maxTurns: 3,
    maxStableFacts: 4,
    maxResumeChars: 400,
    maxScreenTokens: 100,
    includeScreen: true,
    includeResumeDrilldown: false,
    includeDecisions: true,
  },
};

// ─── 8. Thread Transition State Machine (Phase 7 & Mandatory Correction 5) ───

export interface ThreadTransitionResult {
  action: 'MAINTAIN' | 'TRANSITION' | 'CREATE';
  thread: ActiveDiscussionThread;
  transitionReason: string;
}

export function evaluateThreadTransition(params: {
  currentQuestion: string;
  taskType?: TaskType | null;
  currentThread: ActiveDiscussionThread | null;
  timestamp?: string;
}): ThreadTransitionResult {
  const { currentQuestion, currentThread, timestamp = new Date().toISOString() } = params;
  const effectiveTaskType = params.taskType ?? currentThread?.taskType ?? 'GENERAL_TECHNICAL';
  const questionEntities = extractEntitiesFromText(currentQuestion);
  const isFollowUp = isFollowUpQuestion(currentQuestion);

  // 1. If no active thread exists, initialize one
  if (!currentThread) {
    const parentTopic = currentQuestion.length > 80 ? currentQuestion.slice(0, 80).trim() + '...' : currentQuestion.trim();
    const newThread: ActiveDiscussionThread = {
      threadId: `thread_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      parentTopic,
      taskType: effectiveTaskType,
      establishedDecisions: [],
      lastQuestion: currentQuestion,
      startedAt: timestamp,
      turnCount: 1,
      entities: questionEntities,
    };
    return { action: 'CREATE', thread: newThread, transitionReason: 'initial_thread' };
  }

  // 2. If explicit follow-up -> strictly MAINTAIN active thread
  const existingEntities = currentThread.entities || [];
  if (isFollowUp) {
    const updatedThread: ActiveDiscussionThread = {
      ...currentThread,
      lastQuestion: currentQuestion,
      turnCount: currentThread.turnCount + 1,
      entities: Array.from(new Set([...existingEntities, ...questionEntities])),
    };
    return { action: 'MAINTAIN', thread: updatedThread, transitionReason: 'explicit_follow_up' };
  }

  // 3. Check entity overlap with current thread
  const threadEntities = new Set(existingEntities.map(e => e.toLowerCase()));
  const matchingEntities = questionEntities.filter(e => threadEntities.has(e.toLowerCase()));

  if (matchingEntities.length > 0) {
    const updatedThread: ActiveDiscussionThread = {
      ...currentThread,
      lastQuestion: currentQuestion,
      turnCount: currentThread.turnCount + 1,
      entities: Array.from(new Set([...existingEntities, ...questionEntities])),
    };
    return { action: 'MAINTAIN', thread: updatedThread, transitionReason: 'entity_overlap' };
  }

  // 4. Check if task type represents a clear topic divergence
  const isDifferentTaskType = Boolean(
    params.taskType &&
    params.taskType !== 'GENERAL_TECHNICAL' &&
    params.taskType !== currentThread.taskType
  );
  const isExplicitNewTopic =
    /\b(write|implement|solve|explain your|tell me about|let's move to|next question|another topic|new problem)\b/i.test(currentQuestion);

  if (isDifferentTaskType || isExplicitNewTopic) {
    const parentTopic = currentQuestion.length > 80 ? currentQuestion.slice(0, 80).trim() + '...' : currentQuestion.trim();
    const newThread: ActiveDiscussionThread = {
      threadId: `thread_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      parentTopic,
      taskType: params.taskType || currentThread.taskType || 'GENERAL_TECHNICAL',
      establishedDecisions: [],
      lastQuestion: currentQuestion,
      startedAt: timestamp,
      turnCount: 1,
      entities: questionEntities,
    };
    return { action: 'TRANSITION', thread: newThread, transitionReason: 'topic_divergence' };
  }

  // Default: maintain current thread if ambiguous
  const updatedThread: ActiveDiscussionThread = {
    ...currentThread,
    lastQuestion: currentQuestion,
    turnCount: currentThread.turnCount + 1,
  };
  return { action: 'MAINTAIN', thread: updatedThread, transitionReason: 'default_continuity' };
}

// ─── 9. Project-Specific Resume Fact Extraction (Phase 9 & Mandatory Correction 3) ───

export function extractProjectResumeContext(
  resumeText?: string | null,
  targetTopicOrQuestion?: string | null
): string | null {
  if (!resumeText || !resumeText.trim()) return null;
  const raw = resumeText.trim();
  if (!targetTopicOrQuestion) return raw.slice(0, 400);

  const topicEntities = extractEntitiesFromText(targetTopicOrQuestion);
  const lowerQ = targetTopicOrQuestion.toLowerCase();

  // Common project keywords
  const projectKeywords = ['anomaly detection', 'rag', 'mockify', 'payment', 'fraud', 'recommendation', 'search', 'copilot'];
  const matchedKeyword = projectKeywords.find(k => lowerQ.includes(k));

  if (!matchedKeyword && topicEntities.length === 0) {
    return raw.slice(0, 400);
  }

  // Split resume by paragraphs or lines to find matching block
  const blocks = raw.split(/\n\s*\n/);
  const relevantBlocks: string[] = [];

  for (const block of blocks) {
    const lowerBlock = block.toLowerCase();
    const matchesKeyword = matchedKeyword && lowerBlock.includes(matchedKeyword);
    const matchesEntity = topicEntities.some(e => lowerBlock.includes(e.toLowerCase()));

    if (matchesKeyword || matchesEntity) {
      relevantBlocks.push(block.trim());
    }
  }

  if (relevantBlocks.length > 0) {
    return relevantBlocks.join('\n\n').slice(0, 1500).trim();
  }

  return raw.slice(0, 400);
}

// ─── 10. Turn Relevance Scoring Algorithm (Phase 5 & Mandatory Correction 5) ───

export interface ScoredTurn {
  turn: DialogueTurn;
  score: number;
  relevanceReason: string;
  isHardRetained: boolean;
}

export function scoreDialogueTurns(params: {
  turns: DialogueTurn[];
  currentQuestion: string;
  activeThread: ActiveDiscussionThread | null;
  requestType: RequestType;
}): ScoredTurn[] {
  const { turns, currentQuestion, activeThread, requestType } = params;
  if (turns.length === 0) return [];

  const questionEntities = new Set(extractEntitiesFromText(currentQuestion).map(e => e.toLowerCase()));
  const isFollowUp = isFollowUpQuestion(currentQuestion);
  const lastTurnIndex = turns.length - 1;

  return turns.map((turn, index) => {
    let score = 0;
    const reasons: string[] = [];
    let isHardRetained = false;

    const isImmediateAntecedent = index === lastTurnIndex;
    const distance = lastTurnIndex - index;

    // Entity overlap
    const turnEntities = extractEntitiesFromText(turn.text);
    let entityMatchCount = 0;
    for (const ent of turnEntities) {
      if (questionEntities.has(ent.toLowerCase())) {
        entityMatchCount++;
      }
    }
    if (entityMatchCount > 0) {
      const entityBonus = Math.min(45, entityMatchCount * 15);
      score += entityBonus;
      reasons.push(`entity_match_${entityMatchCount}`);
    }

    const isDifferentThread = Boolean(activeThread && turn.threadId && turn.threadId !== activeThread.threadId);
    const hasThreadDivergence = isDifferentThread && entityMatchCount === 0;
    const isScreenRequestWithoutOverlap = requestType === 'SCREEN' && entityMatchCount === 0;

    // Hard Rule 1: Immediate antecedent for follow-ups or continuations
    // A turn from a diverged thread with 0 entity overlap CANNOT be the antecedent for the active thread!
    // For SCREEN requests without entity overlap, the screen observation is the primary referent!
    if (isImmediateAntecedent && !hasThreadDivergence && !isScreenRequestWithoutOverlap && (isFollowUp || requestType === 'CONTINUATION')) {
      score += 100;
      isHardRetained = true;
      reasons.push('immediate_followup_antecedent');
    }

    // Thread co-occurrence
    if (activeThread && turn.threadId === activeThread.threadId) {
      score += 25;
      reasons.push('active_thread_turn');
    }

    // Task type match
    if (activeThread?.taskType && turn.taskType === activeThread.taskType) {
      score += 15;
      reasons.push('task_type_match');
    }

    // Recency decay (-3 per turn back)
    score -= distance * 3;

    // Thread divergence penalty: if turn is from an old thread and has NO entity overlap with current question
    if (hasThreadDivergence) {
      score -= 50;
      reasons.push('unrelated_old_thread');
    }

    return {
      turn,
      score,
      relevanceReason: reasons.join(';') || 'background_history',
      isHardRetained,
    };
  });
}

// ─── 11. Stable Facts Integrity & Filtering (Phase 8) ───

export function filterRelevantStableFacts(params: {
  stableFacts: EstablishedFact[];
  currentQuestion: string;
  activeThread: ActiveDiscussionThread | null;
  maxFacts: number;
}): string[] {
  const { stableFacts, currentQuestion, activeThread, maxFacts } = params;
  if (stableFacts.length === 0 || maxFacts <= 0) return [];

  const entities = new Set([
    ...extractEntitiesFromText(currentQuestion).map(e => e.toLowerCase()),
    ...(activeThread ? extractEntitiesFromText(activeThread.parentTopic).map(e => e.toLowerCase()) : [])
  ]);

  // Rank facts: facts matching entities or active thread decisions score higher
  const scored = stableFacts
    .filter(f => !f.isSuperseded)
    .map(factObj => {
      let score = 0;
      const lowerFact = factObj.fact.toLowerCase();
      for (const ent of entities) {
        if (lowerFact.includes(ent)) {
          score += 20;
        }
      }
      if (factObj.category === 'architecture' || factObj.category === 'decision') {
        score += 10;
      }
      if (factObj.source === 'explicit_constraint' || factObj.source === 'verified_resume') {
        score += 15;
      }
      return { fact: factObj.fact, score };
    });

  // Sort descending by score, take top maxFacts, deduplicate
  scored.sort((a, b) => b.score - a.score);
  const uniqueFacts = new Set<string>();
  for (const s of scored) {
    uniqueFacts.add(s.fact);
    if (uniqueFacts.size >= maxFacts) break;
  }

  return Array.from(uniqueFacts);
}

// ─── 12. Server-Authoritative Relevant Context Signature (Mandatory Correction 4) ───

export function computeRelevantContextSignature(params: {
  requestType: RequestType;
  question?: string | null;
  activeThread?: { parentTopic: string; taskType: TaskType; decisions: string[] } | null;
  screenObservation?: { problem: string; codeSnippet: string | null } | null;
  selectedTurns: Array<{ speaker: string; text: string }>;
  selectedFacts: string[];
  resumeContext?: string | null;
  candidateProfile?: { role: string; skills: string[] } | null;
}): string {
  const normQ = (params.question || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const threadPart = params.activeThread
    ? `thread:${params.activeThread.parentTopic}:${params.activeThread.taskType}:${params.activeThread.decisions.join(';')}`
    : 'no_thread';

  const screenPart = params.screenObservation
    ? `screen:${params.screenObservation.problem}:${params.screenObservation.codeSnippet || ''}`
    : 'no_screen';

  const turnsPart = params.selectedTurns
    .map(t => `${t.speaker}:${t.text.trim()}`)
    .join('|');

  const factsPart = params.selectedFacts.join(';');
  const resumePart = (params.resumeContext || '').trim().slice(0, 300);
  const profilePart = params.candidateProfile
    ? `${params.candidateProfile.role}:${(params.candidateProfile.skills || []).join(',')}`
    : '';

  const raw = [
    `req:${params.requestType}`,
    `q:${normQ}`,
    threadPart,
    screenPart,
    `turns:${turnsPart}`,
    `facts:${factsPart}`,
    `resume:${resumePart}`,
    `profile:${profilePart}`,
  ].join('||');

  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x100000001b3);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (hex1 + hex2).slice(0, 16);
}

// ─── 13. CANONICAL CONTEXT SELECTION ALGORITHM (Mandatory Correction 1, 3, 5) ───

export interface IntelligentContextSelectionInput {
  contextVersion: number;
  question: string;
  userPrompt?: string | null;
  taskType?: TaskType | null;
  activeThread: ActiveDiscussionThread | null;
  latestScreenObservation: CompactScreenObservation | null;
  recentTurns: DialogueTurn[];
  stableFacts: EstablishedFact[];
  candidateFacts: CandidateFacts;
  rollingSummary?: string | null;
  requestTypeOverride?: RequestType;
  isContinuation?: boolean;
  hasImage?: boolean;
  targetTokenBudgetOverride?: number;
}

export function selectIntelligentContext(
  input: IntelligentContextSelectionInput
): BoundedContextPayload {
  const currentQuestion = input.question.trim();
  const requestType = input.requestTypeOverride || deduceRequestType({
    question: currentQuestion,
    taskType: input.taskType,
    isContinuation: input.isContinuation,
    hasImage: input.hasImage,
  });

  const config = REQUEST_TYPE_CONFIGS[requestType];
  const targetBudget = input.targetTokenBudgetOverride || config.targetTokens;
  let budgetRemaining = targetBudget;

  // 1. Mandatory P0: Current Question & Prompt
  budgetRemaining -= estimateTokens(currentQuestion);
  if (input.userPrompt) {
    budgetRemaining -= estimateTokens(input.userPrompt);
  }

  // 2. Request-Specific Screen Observation (Mandatory Correction 3: Screen requests require screen evidence)
  let screenObservationPayload: BoundedContextPayload['screenObservation'] = null;
  if (config.includeScreen && input.latestScreenObservation && !input.latestScreenObservation.isSuperseded) {
    const obs = input.latestScreenObservation;
    screenObservationPayload = {
      problem: obs.primaryQuestionOrProblem,
      entities: [...obs.keyEntitiesAndConstraints],
      codeSnippet: obs.codeSnippet,
    };
    budgetRemaining -= estimateTokens(obs.primaryQuestionOrProblem);
    if (obs.codeSnippet) {
      budgetRemaining -= estimateTokens(obs.codeSnippet);
    }
  }

  // 3. Active Thread Metadata
  let activeThreadPayload: BoundedContextPayload['activeThread'] = null;
  if (input.activeThread && !input.activeThread.isClosed) {
    activeThreadPayload = {
      parentTopic: input.activeThread.parentTopic,
      taskType: input.activeThread.taskType,
      decisions: config.includeDecisions ? [...input.activeThread.establishedDecisions] : [],
    };
    budgetRemaining -= estimateTokens(activeThreadPayload.parentTopic);
    for (const d of activeThreadPayload.decisions) {
      budgetRemaining -= estimateTokens(d);
    }
  }

  // 4. Relevant Resume Facts (Mandatory Correction 3: Drilldown requires project facts; Coding suppresses raw dumps)
  let resumeContextPayload: string | null = null;
  if (config.includeResumeDrilldown || config.maxResumeChars > 0) {
    const extracted = extractProjectResumeContext(
      input.candidateFacts.focusNotes || '',
      currentQuestion
    );
    if (extracted && config.maxResumeChars > 0) {
      resumeContextPayload = extracted.slice(0, config.maxResumeChars).trim();
      budgetRemaining -= estimateTokens(resumeContextPayload);
    }
  }

  // 5. Relevant Prior Dialogue Turns (Phase 5 & Mandatory Correction 5)
  const scoredTurns = scoreDialogueTurns({
    turns: input.recentTurns,
    currentQuestion,
    activeThread: input.activeThread,
    requestType,
  });

  // Partition into hard-retained turns vs ranked turns
  const hardRetained = scoredTurns.filter(s => s.isHardRetained);
  const candidateTurns = scoredTurns.filter(s => !s.isHardRetained && s.score > 0);
  candidateTurns.sort((a, b) => b.score - a.score);

  const selectedTurnsList: Array<{
    turn: DialogueTurn;
    relevanceReason?: string;
  }> = [];

  // Add hard retained turns first
  for (const h of hardRetained) {
    selectedTurnsList.push({ turn: h.turn, relevanceReason: h.relevanceReason });
    budgetRemaining -= h.turn.tokenCount || estimateTokens(h.turn.text);
  }

  // Add top candidate turns within config.maxTurns and budgetRemaining
  for (const c of candidateTurns) {
    if (selectedTurnsList.length >= config.maxTurns) break;
    const cost = c.turn.tokenCount || estimateTokens(c.turn.text);
    if (budgetRemaining - cost < 30 && selectedTurnsList.length >= 1) {
      break;
    }
    selectedTurnsList.push({ turn: c.turn, relevanceReason: c.relevanceReason });
    budgetRemaining -= cost;
  }

  // Sort selected turns in chronological order by sequence number
  selectedTurnsList.sort((a, b) => a.turn.sequenceNumber - b.turn.sequenceNumber);

  const finalRecentTurns = selectedTurnsList.map(item => ({
    speaker: item.turn.speaker,
    source: item.turn.source,
    text: item.turn.text,
    relevanceReason: item.relevanceReason,
  }));

  // 6. Relevant Stable Facts (Phase 8)
  const selectedStableFacts = filterRelevantStableFacts({
    stableFacts: input.stableFacts,
    currentQuestion,
    activeThread: input.activeThread,
    maxFacts: config.maxStableFacts,
  });
  for (const f of selectedStableFacts) {
    budgetRemaining -= estimateTokens(f);
  }

  // 7. Rolling Summary (Lowest Priority, only if budget allows)
  let summaryPayload: string | null = null;
  if (input.rollingSummary && budgetRemaining >= estimateTokens(input.rollingSummary)) {
    summaryPayload = input.rollingSummary;
    budgetRemaining -= estimateTokens(summaryPayload);
  }

  // Candidate profile summary
  const candidateProfile = {
    role: input.candidateFacts.jobTitle,
    level: input.candidateFacts.experienceLevel,
    skills: input.candidateFacts.keySkills,
    mode: input.candidateFacts.mode,
  };

  const estimatedTokensUsed = targetBudget - Math.max(0, budgetRemaining);

  // 8. Derive Server-Authoritative Relevant Context Signature (Mandatory Correction 4)
  const relevantContextSignature = computeRelevantContextSignature({
    requestType,
    question: currentQuestion,
    activeThread: activeThreadPayload,
    screenObservation: screenObservationPayload,
    selectedTurns: finalRecentTurns,
    selectedFacts: selectedStableFacts,
    resumeContext: resumeContextPayload,
    candidateProfile,
  });

  return {
    contextVersion: input.contextVersion,
    relevantContextSignature,
    requestType,
    estimatedTokens: estimatedTokensUsed,
    current: {
      question: currentQuestion,
      userPrompt: input.userPrompt || null,
      taskType: input.taskType || null,
    },
    activeThread: activeThreadPayload,
    screenObservation: screenObservationPayload,
    recentTurns: finalRecentTurns,
    stableFacts: selectedStableFacts,
    resumeContext: resumeContextPayload,
    summary: summaryPayload,
    candidateProfile,
  };
}
