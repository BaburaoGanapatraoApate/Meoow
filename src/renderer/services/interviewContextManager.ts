import { v4 as uuidv4 } from 'uuid';
import type {
  InterviewContext,
  ContextEvent,
  ContextEventType,
  ActiveDiscussionThread,
  CompactScreenObservation,
  DialogueTurn,
  EstablishedFact,
  CandidateFacts,
  CurrentContextSlot,
  BoundedContextPayload,
  TaskType,
} from '../types';

export interface ContextEventInput {
  type: ContextEventType;
  payload: any;
  requestId?: string;
}

export type ContextChangeListener = (context: Readonly<InterviewContext>, event: ContextEvent) => void;

/** Approximate token counting (~4 characters per token) */
export function estimateTokens(text?: string | null): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

/** Extract key technical skills from text deterministically */
export function extractSkillsFromText(text?: string | null): string[] {
  if (!text) return [];
  const knownSkills = [
    'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'Go', 'Rust', 'Ruby',
    'React', 'Next.js', 'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Spring Boot',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'Elasticsearch',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Kafka', 'GraphQL', 'REST',
    'PyTorch', 'TensorFlow', 'Scikit-learn', 'LightGBM', 'XGBoost', 'HuggingFace',
    'System Design', 'Microservices', 'Distributed Systems', 'CI/CD',
  ];

  const matched = new Set<string>();
  for (const skill of knownSkills) {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      matched.add(skill);
    }
  }
  return Array.from(matched);
}

const DEFAULT_INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

export class InterviewContextManager {
  private sessionId: string = '';
  private contextVersion: number = 0;
  private sequenceNumber: number = 0;
  private activeDiscussionThread: ActiveDiscussionThread | null = null;
  private current: CurrentContextSlot = {
    question: null,
    userPrompt: null,
    taskType: null,
    confidence: null,
    latestScreenObservation: null,
  };
  private recentTurns: DialogueTurn[] = [];
  private stableFacts: EstablishedFact[] = [];
  private rollingSummary: string | null = null;
  private candidateFacts: CandidateFacts = {
    jobTitle: '',
    company: '',
    interviewRound: '',
    experienceLevel: '',
    keySkills: [],
    mode: 'GENERAL',
  };

  private listeners: Set<ContextChangeListener> = new Set();
  private inactivityTimer: any = null;
  private inactivityTimeoutMs: number = DEFAULT_INACTIVITY_MS;
  private onInactivityExpiredCallback?: () => void;
  private recentEvents: ContextEvent[] = [];

  /**
   * Initialize a fresh, empty interview session context.
   */
  public initSession(config: {
    sessionId: string;
    job_title?: string;
    company?: string;
    interview_round?: string;
    experience_level?: string;
    notes?: string;
    resume_text?: string;
    inactivityTimeoutMs?: number;
    onInactivityExpired?: () => void;
  }): Readonly<InterviewContext> {
    this.destroySession();

    this.sessionId = config.sessionId || uuidv4();
    this.contextVersion = 0;
    this.sequenceNumber = 0;
    if (config.inactivityTimeoutMs !== undefined) {
      this.inactivityTimeoutMs = config.inactivityTimeoutMs;
    }
    this.onInactivityExpiredCallback = config.onInactivityExpired;

    // Build compact candidate profile without storing unbounded resume text
    const skills = extractSkillsFromText(`${config.resume_text || ''} ${config.notes || ''}`);
    const isPersonalized = Boolean(config.resume_text && config.resume_text.trim().length > 50);

    this.candidateFacts = {
      jobTitle: config.job_title || 'Software Engineer',
      company: config.company || '',
      interviewRound: config.interview_round || 'technical',
      experienceLevel: config.experience_level || 'mid-level',
      focusNotes: config.notes ? config.notes.slice(0, 300) : undefined,
      keySkills: skills.slice(0, 15),
      mode: isPersonalized ? 'PERSONALIZED' : 'GENERAL',
    };

    this.resetInactivityTimer();

    this.dispatchInternal({
      type: 'SESSION_INITIALIZED',
      payload: { sessionId: this.sessionId, candidateFacts: this.candidateFacts },
    });

    return this.getSnapshot();
  }

  /**
   * Subscribe to context mutations.
   */
  public subscribe(listener: ContextChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Reset the inactivity watchdog timer.
   */
  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    if (this.sessionId && this.inactivityTimeoutMs > 0) {
      this.inactivityTimer = setTimeout(() => {
        this.destroySession();
        this.onInactivityExpiredCallback?.();
      }, this.inactivityTimeoutMs);
    }
  }

  /**
   * Internal sequential event dispatch & monotonic version update.
   */
  private dispatchInternal(input: ContextEventInput): ContextEvent {
    this.sequenceNumber++;
    this.contextVersion++;
    this.resetInactivityTimer();

    const event: ContextEvent = {
      eventId: `evt_${Date.now()}_${this.sequenceNumber}`,
      sequenceNumber: this.sequenceNumber,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      contextVersion: this.contextVersion,
      type: input.type,
      payload: input.payload,
    };

    // Keep ring buffer of last 50 events for diagnostics
    this.recentEvents.push(event);
    if (this.recentEvents.length > 50) {
      this.recentEvents.shift();
    }

    // Process event state reduction
    switch (input.type) {
      case 'TRANSCRIPT_TURN_ADDED': {
        const { speaker, text, source } = input.payload;
        const turn: DialogueTurn = {
          turnId: `turn_${this.sequenceNumber}`,
          sequenceNumber: this.sequenceNumber,
          speaker,
          source: source || 'audio',
          text,
          timestamp: event.timestamp,
          tokenCount: estimateTokens(text),
        };
        this.recentTurns.push(turn);
        // Keep in-memory turns bounded to last 20
        if (this.recentTurns.length > 20) {
          this.recentTurns.shift();
        }

        if (speaker === 'interviewer') {
          this.current.question = text;
        }
        break;
      }

      case 'SCREEN_OBSERVATION_RECORDED': {
        const obs = input.payload as CompactScreenObservation;
        // Strictly reject any accidental image payload or base64
        if (
          obs.primaryQuestionOrProblem?.startsWith('data:') ||
          obs.codeSnippet?.startsWith('data:')
        ) {
          throw new Error('Raw screenshot binaries or data URLs must NOT enter InterviewContext.');
        }

        this.current.latestScreenObservation = obs;
        if (obs.taskType) {
          this.current.taskType = obs.taskType;
        }

        // If no active thread exists, initialize it from the screen problem
        if (!this.activeDiscussionThread && obs.primaryQuestionOrProblem) {
          this.activeDiscussionThread = {
            threadId: `thread_${Date.now()}`,
            parentTopic: obs.primaryQuestionOrProblem.slice(0, 100),
            taskType: obs.taskType || 'SYSTEM_DESIGN',
            establishedDecisions: [],
            lastQuestion: obs.primaryQuestionOrProblem,
            startedAt: event.timestamp,
            turnCount: 1,
          };
        }
        break;
      }

      case 'MANUAL_QUESTION_SUBMITTED': {
        const { text, taskType } = input.payload;
        this.current.userPrompt = text;
        if (taskType) {
          this.current.taskType = taskType;
        }
        const turn: DialogueTurn = {
          turnId: `turn_${this.sequenceNumber}`,
          sequenceNumber: this.sequenceNumber,
          speaker: 'candidate',
          source: 'manual',
          text: text.trim(),
          timestamp: event.timestamp,
          tokenCount: estimateTokens(text),
        };
        this.recentTurns.push(turn);
        if (this.recentTurns.length > 20) {
          this.recentTurns.shift();
        }
        break;
      }

      case 'AI_ANSWER_RECORDED': {
        const { answer, taskType, decisions, source } = input.payload;
        const conciseSummary = answer.length > 150 ? answer.slice(0, 150).trim() + '...' : answer.trim();
        if (this.activeDiscussionThread) {
          this.activeDiscussionThread.lastAnswerSummary = conciseSummary;
          this.activeDiscussionThread.turnCount++;
          if (Array.isArray(decisions) && decisions.length > 0) {
            this.activeDiscussionThread.establishedDecisions.push(...decisions);
          }
        }
        if (taskType) {
          this.current.taskType = taskType;
        }
        const turn: DialogueTurn = {
          turnId: `turn_${this.sequenceNumber}`,
          sequenceNumber: this.sequenceNumber,
          speaker: 'meoow',
          source: source || 'manual',
          text: conciseSummary,
          timestamp: event.timestamp,
          tokenCount: estimateTokens(conciseSummary),
        };
        this.recentTurns.push(turn);
        if (this.recentTurns.length > 20) {
          this.recentTurns.shift();
        }
        break;
      }

      case 'DISCUSSION_THREAD_UPDATED': {
        const update = input.payload as Partial<ActiveDiscussionThread>;
        if (this.activeDiscussionThread) {
          this.activeDiscussionThread = {
            ...this.activeDiscussionThread,
            ...update,
          };
        } else if (update.parentTopic && update.taskType) {
          this.activeDiscussionThread = {
            threadId: `thread_${Date.now()}`,
            parentTopic: update.parentTopic,
            taskType: update.taskType,
            establishedDecisions: update.establishedDecisions || [],
            lastQuestion: update.lastQuestion || '',
            lastAnswerSummary: update.lastAnswerSummary,
            startedAt: event.timestamp,
            turnCount: 1,
          };
        }
        break;
      }

      case 'FACT_ESTABLISHED': {
        const { category, fact } = input.payload;
        this.stableFacts.push({
          factId: `fact_${this.sequenceNumber}`,
          category,
          fact,
          establishedAt: event.timestamp,
        });
        if (this.stableFacts.length > 15) {
          this.stableFacts.shift();
        }
        break;
      }

      case 'SESSION_DESTROYED': {
        // Reducer handles cleanup
        break;
      }
    }

    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot, event);
      } catch (err) {
        console.error('[InterviewContextManager] Listener error:', err);
      }
    }

    return event;
  }

  /**
   * Dispatch a context event publicly.
   */
  public dispatch(input: ContextEventInput): ContextEvent {
    return this.dispatchInternal(input);
  }

  /**
   * Add an interviewer spoken question/turn.
   */
  public addInterviewerTurn(text: string, source: 'audio' | 'screen' | 'manual' = 'audio'): ContextEvent {
    return this.dispatchInternal({
      type: 'TRANSCRIPT_TURN_ADDED',
      payload: { speaker: 'interviewer', text: text.trim(), source },
    });
  }

  /**
   * Add a candidate spoken response turn.
   */
  public addCandidateTurn(text: string, source: 'audio' | 'screen' | 'manual' = 'audio'): ContextEvent {
    return this.dispatchInternal({
      type: 'TRANSCRIPT_TURN_ADDED',
      payload: { speaker: 'candidate', text: text.trim(), source },
    });
  }

  /**
   * Add a compact screen observation (strictly text metadata).
   */
  public addScreenObservation(observation: {
    primaryQuestionOrProblem: string;
    keyEntitiesAndConstraints?: string[];
    codeSnippet?: string | null;
    taskType?: TaskType;
  }): ContextEvent {
    const compact: CompactScreenObservation = {
      observationId: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      taskType: observation.taskType,
      primaryQuestionOrProblem: observation.primaryQuestionOrProblem.trim(),
      keyEntitiesAndConstraints: observation.keyEntitiesAndConstraints || [],
      codeSnippet: observation.codeSnippet ? observation.codeSnippet.trim() : null,
      tokenCount:
        estimateTokens(observation.primaryQuestionOrProblem) +
        estimateTokens(observation.codeSnippet) +
        (observation.keyEntitiesAndConstraints || []).reduce(
          (acc, e) => acc + estimateTokens(e),
          0
        ),
    };

    return this.dispatchInternal({
      type: 'SCREEN_OBSERVATION_RECORDED',
      payload: compact,
    });
  }

  /**
   * Add a manual question submitted by user.
   */
  public addManualQuestion(text: string, taskType?: TaskType): ContextEvent {
    return this.dispatchInternal({
      type: 'MANUAL_QUESTION_SUBMITTED',
      payload: { text: text.trim(), taskType },
    });
  }

  /**
   * Update active discussion thread.
   */
  public updateThread(threadUpdate: Partial<ActiveDiscussionThread>): ContextEvent {
    return this.dispatchInternal({
      type: 'DISCUSSION_THREAD_UPDATED',
      payload: threadUpdate,
    });
  }

  /**
   * Establish an immutable technical decision or constraint.
   */
  public addFact(category: EstablishedFact['category'], fact: string): ContextEvent {
    return this.dispatchInternal({
      type: 'FACT_ESTABLISHED',
      payload: { category, fact: fact.trim() },
    });
  }

  /**
   * Record completion of an AI answer stream, handling out-of-order execution safely.
   */
  public recordAnswerCompletion(
    requestId: string,
    baseContextVersion: number,
    answerText: string,
    metadata?: { taskType?: TaskType; decisions?: string[]; source?: 'audio' | 'screen' | 'manual' }
  ): ContextEvent {
    return this.dispatchInternal({
      type: 'AI_ANSWER_RECORDED',
      requestId,
      payload: {
        answer: answerText,
        baseContextVersion,
        isStaleCompletion: baseContextVersion < this.contextVersion,
        taskType: metadata?.taskType,
        decisions: metadata?.decisions,
        source: metadata?.source,
      },
    });
  }

  /**
   * Returns a deep, immutable snapshot of the current InterviewContext.
   */
  public getSnapshot(): Readonly<InterviewContext> {
    const deepClone = (obj: any): any => {
      if (typeof structuredClone === 'function') {
        try {
          return structuredClone(obj);
        } catch {}
      }
      return JSON.parse(JSON.stringify(obj));
    };

    return Object.freeze({
      sessionId: this.sessionId,
      contextVersion: this.contextVersion,
      lastSequenceNumber: this.sequenceNumber,
      activeDiscussionThread: deepClone(this.activeDiscussionThread),
      current: deepClone(this.current),
      recentTurns: deepClone(this.recentTurns),
      stableFacts: deepClone(this.stableFacts),
      rollingSummary: this.rollingSummary,
      candidateFacts: deepClone(this.candidateFacts),
    });
  }

  /**
   * Build a bounded context payload bounded by target token budget (~750 tokens).
   * Uses priority-based pruning:
   * CURRENT > ACTIVE THREAD > LATEST SCREEN > RECENT RELEVANT > STABLE FACTS > OLD SUMMARY.
   */
  public getBoundedContext(targetTokenBudget: number = 750): BoundedContextPayload {
    let budgetRemaining = targetTokenBudget;

    // 1. Priority 1: CURRENT (question, userPrompt, taskType)
    const currentQuestion = this.current.question;
    const userPrompt = this.current.userPrompt;
    const taskType = this.current.taskType;

    budgetRemaining -= estimateTokens(currentQuestion);
    budgetRemaining -= estimateTokens(userPrompt);

    // 2. Priority 2: ACTIVE THREAD
    let activeThread: BoundedContextPayload['activeThread'] = null;
    if (this.activeDiscussionThread) {
      activeThread = {
        parentTopic: this.activeDiscussionThread.parentTopic,
        taskType: this.activeDiscussionThread.taskType,
        decisions: [...this.activeDiscussionThread.establishedDecisions],
      };
      budgetRemaining -= estimateTokens(activeThread.parentTopic);
      for (const d of activeThread.decisions) {
        budgetRemaining -= estimateTokens(d);
      }
    }

    // 3. Priority 3: LATEST SCREEN (problem + entities + code)
    let screenObservation: BoundedContextPayload['screenObservation'] = null;
    if (this.current.latestScreenObservation) {
      const obs = this.current.latestScreenObservation;
      screenObservation = {
        problem: obs.primaryQuestionOrProblem,
        entities: [...obs.keyEntitiesAndConstraints],
        codeSnippet: obs.codeSnippet,
      };
      budgetRemaining -= estimateTokens(screenObservation.problem);
      for (const e of screenObservation.entities) {
        budgetRemaining -= estimateTokens(e);
      }
      if (screenObservation.codeSnippet) {
        budgetRemaining -= estimateTokens(screenObservation.codeSnippet);
      }
    }

    // 4. Priority 4: RECENT RELEVANT TURNS (reverse chronological until budget exhausted)
    const recentTurns: Array<{
      speaker: 'interviewer' | 'candidate' | 'meoow';
      source?: 'audio' | 'screen' | 'manual';
      text: string;
    }> = [];
    for (let i = this.recentTurns.length - 1; i >= 0; i--) {
      const turn = this.recentTurns[i];
      const cost = turn.tokenCount || estimateTokens(turn.text);
      if (budgetRemaining - cost < 50 && recentTurns.length >= 2) {
        // Stop adding turns when budget is getting tight, but keep at least 2 turns if possible
        break;
      }
      recentTurns.unshift({
        speaker: turn.speaker,
        source: turn.source,
        text: turn.text,
      });
      budgetRemaining -= cost;
    }

    // 5. Priority 5: STABLE FACTS
    const stableFacts: string[] = [];
    for (const factObj of this.stableFacts) {
      const cost = estimateTokens(factObj.fact);
      if (budgetRemaining - cost >= 30) {
        stableFacts.push(factObj.fact);
        budgetRemaining -= cost;
      }
    }

    // 6. Priority 6: SUMMARY (Lowest priority: only included if budget allows)
    let summary: string | null = null;
    if (this.rollingSummary && budgetRemaining >= estimateTokens(this.rollingSummary)) {
      summary = this.rollingSummary;
      budgetRemaining -= estimateTokens(summary);
    }

    // Candidate profile (compact)
    const candidateProfile = {
      role: this.candidateFacts.jobTitle,
      level: this.candidateFacts.experienceLevel,
      skills: this.candidateFacts.keySkills,
      mode: this.candidateFacts.mode,
    };

    const totalUsed = targetTokenBudget - Math.max(0, budgetRemaining);

    return {
      contextVersion: this.contextVersion,
      estimatedTokens: totalUsed,
      current: {
        question: currentQuestion,
        userPrompt,
        taskType,
      },
      activeThread,
      screenObservation,
      recentTurns,
      stableFacts,
      summary,
      candidateProfile,
    };
  }

  /**
   * Completely destroy the interview context and purge all state from memory.
   */
  public destroySession(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    this.sessionId = '';
    this.contextVersion = 0;
    this.sequenceNumber = 0;
    this.activeDiscussionThread = null;
    this.current = {
      question: null,
      userPrompt: null,
      taskType: null,
      confidence: null,
      latestScreenObservation: null,
    };
    this.recentTurns = [];
    this.stableFacts = [];
    this.rollingSummary = null;
    this.candidateFacts = {
      jobTitle: '',
      company: '',
      interviewRound: '',
      experienceLevel: '',
      keySkills: [],
      mode: 'GENERAL',
    };
    this.recentEvents = [];

    // Notify listeners of destruction
    for (const listener of this.listeners) {
      try {
        listener(this.getSnapshot(), {
          eventId: `evt_destroy_${Date.now()}`,
          sequenceNumber: 0,
          timestamp: new Date().toISOString(),
          contextVersion: 0,
          type: 'SESSION_DESTROYED',
          payload: {},
        });
      } catch {}
    }
  }

  /**
   * Check if an active interview session currently exists.
   */
  public hasActiveSession(): boolean {
    return Boolean(this.sessionId);
  }

  /**
   * Alias for getBoundedContext to build bounded context payload.
   */
  public buildBoundedContextPayload(targetTokenBudget: number = 750): BoundedContextPayload {
    return this.getBoundedContext(targetTokenBudget);
  }

  /**
   * Convenience alias to record AI answer text.
   */
  public recordAiAnswer(
    answerText: string,
    source: 'audio' | 'screen' | 'manual' = 'manual',
    taskType?: TaskType
  ): ContextEvent {
    return this.recordAnswerCompletion(
      `ans_${Date.now()}`,
      this.contextVersion,
      answerText,
      { taskType, source }
    );
  }

  /**
   * Convenience alias to set/add manual question.
   */
  public setManualQuestion(text: string, taskType?: TaskType): ContextEvent {
    return this.addManualQuestion(text, taskType);
  }

  /**
   * Get current context version number.
   */
  public getVersion(): number {
    return this.contextVersion;
  }

  /**
   * Get current sequence number.
   */
  public getSequenceNumber(): number {
    return this.sequenceNumber;
  }
}

export const interviewContextManager = new InterviewContextManager();

