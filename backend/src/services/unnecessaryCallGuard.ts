/**
 * ============================================================================
 * UNNECESSARY CALL GUARD (CANONICAL IMPLEMENTATION)
 * ============================================================================
 * Task 9: Eliminate Unnecessary AI Calls.
 *
 * Core Invariant:
 *   FEWER REDUNDANT PROVIDER CALLS
 *   + NO WRONG ANSWER REUSE
 *   + NO MISSED REQUIRED GENERATION
 *   + NO CREDIT REGRESSION
 *   + NO PROVIDER REGRESSION
 *   + NO CONTEXT REGRESSION
 *
 * IF THERE IS ANY DOUBT: GENERATE.
 * ============================================================================
 */

import crypto from "crypto";
import { Response } from "express";
import {
  computePromptHash,
  computeServerContextSignature,
  screenAnalysisCache,
  screenRequestCoalescer,
  computeBinaryImageFingerprint,
} from "./screenDeduplicationService";

export interface LogicalChatIdentityParams {
  userId: string;
  sessionId: string;
  model: string;
  taskType?: string;
  parentTaskType?: string;
  question?: string;
  suggestedDepth?: string;
  requiresCode?: boolean;
  language?: string;
  isContinuation?: boolean;
  contextSig: string;
}

export interface CachedChatAnalysis {
  compositeKey: string;
  userId: string;
  sessionId: string;
  modelUsed: string;
  answer: string;
  finishReason: string;
  createdAt: number;
  expiresAt: number;
  contextSig: string;
  promptHash: string;
  taskType: string;
}

export interface ChatSubscriber {
  id: string;
  res: Response;
  isLeader: boolean;
  sendSSE: (data: any) => void;
}

export interface ChatInFlightEntry {
  compositeKey: string;
  userId: string;
  sessionId: string;
  model: string;
  contextSig: string;
  promptHash: string;
  taskType: string;
  leaderId: string;
  subscribers: Map<string, ChatSubscriber>;
  abortController: AbortController;
  chunksDispatched: number;
  hasStarted: boolean;
  startPayload?: any;
  chunkReplayBuffer: string[];
  replayByteLength: number;
  isFinished: boolean;
  donePayload?: any;
  reservation?: any;
  startTime: number;
}

export interface LeaderElectionResult {
  isLeader: boolean;
  inFlight: ChatInFlightEntry;
  subscriber: ChatSubscriber;
}

export type GenerationDecision =
  | 'GENERATE'
  | 'REUSE_COMPLETED'
  | 'JOIN_EXISTING'
  | 'USE_EXISTING_CLASSIFICATION'
  | 'SKIP_NO_NEW_INFORMATION';

export type DecisionReason =
  | 'DUPLICATE_IN_FLIGHT'
  | 'DUPLICATE_COMPLETED'
  | 'SCREEN_CACHE_HIT'
  | 'SCREEN_IN_FLIGHT'
  | 'NEW_QUESTION'
  | 'CONTEXT_CHANGED'
  | 'SCREEN_CHANGED'
  | 'SESSION_CHANGED'
  | 'FOLLOW_UP'
  | 'UNCERTAIN_IDENTITY'
  | 'CLASSIFICATION_REUSED';

export interface GenerationDecisionResult {
  decision: GenerationDecision;
  reason: DecisionReason;
  compositeKey?: string;
  promptHash?: string;
  contextSig?: string;
  cachedAnswer?: string;
  inFlightEntry?: ChatInFlightEntry;
  isLeader?: boolean;
}

/**
 * 1. Classification Call Audit (Mandatory Correction 4)
 * taskClassifier.ts is a 100% deterministic local regex/heuristic classifier.
 * Zero LLM/provider calls are executed for task classification.
 */
export const AUDITED_CLASSIFICATION_STATUS = {
  usesLlmClassifier: false,
  isLocalDeterministic: true,
  callsEliminated: 0,
  description: "Task classification in Meoow is 100% local deterministic regex; zero LLM calls exist or require elimination.",
};

/**
 * 2. Logical Request Identity Constructor (Mandatory Correction 6)
 * Binds ALL answer-affecting inputs:
 * - userId, sessionId, model
 * - taskType, parentTaskType
 * - normalized promptHash (preserves operators, punctuation)
 * - contextSig (Task 6 server context signature)
 * - depth, requiresCode, language, isContinuation
 */
export function computeLogicalChatIdentity(params: LogicalChatIdentityParams): {
  compositeKey: string;
  promptHash: string;
} {
  const promptHash = computePromptHash(params.question);
  const taskType = params.taskType || "GENERAL_TECHNICAL";
  const parentTaskType = params.parentTaskType || "";
  const depth = params.suggestedDepth || "NORMAL";
  const requiresCode = params.requiresCode ? "1" : "0";
  const lang = params.language || "en";
  const cont = params.isContinuation ? "1" : "0";

  const rawKey = [
    `u:${params.userId}`,
    `s:${params.sessionId}`,
    `m:${params.model}`,
    `t:${taskType}`,
    `pt:${parentTaskType}`,
    `d:${depth}`,
    `c:${requiresCode}`,
    `l:${lang}`,
    `cont:${cont}`,
    `p:${promptHash}`,
    `ctx:${params.contextSig}`,
  ].join("|");

  const compositeKey = crypto.createHash("sha256").update(rawKey).digest("hex");
  return { compositeKey, promptHash };
}

/**
 * 3. Non-Screen Chat Analysis Cache (Mandatory Correction 5)
 * - Max 50 entries
 * - TTL 60 seconds
 * - LRU eviction
 * - Strict user + session isolation
 * - Stores completed successful answers only (never errors, partial streams, or incomplete)
 * - Supports session invalidation (logout/account switch)
 */
export class ChatAnalysisCache {
  private cache = new Map<string, CachedChatAnalysis>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries = 50, ttlMs = 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  public get(compositeKey: string): CachedChatAnalysis | null {
    const entry = this.cache.get(compositeKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(compositeKey);
      return null;
    }

    // Refresh LRU ordering
    this.cache.delete(compositeKey);
    this.cache.set(compositeKey, entry);
    return entry;
  }

  public set(params: {
    compositeKey: string;
    userId: string;
    sessionId: string;
    modelUsed: string;
    answer: string;
    finishReason?: string;
    isComplete?: boolean;
    isError?: boolean;
    contextSig: string;
    promptHash: string;
    taskType?: string;
  }): boolean {
    // Invariants: Never cache errors or incomplete answers
    if (params.isError || params.finishReason === "error") {
      return false;
    }
    if (params.isComplete === false || params.finishReason === "length") {
      return false;
    }
    if (!params.answer || params.answer.trim().length === 0) {
      return false;
    }

    // Evict expired first
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }

    // Enforce LRU capacity limit
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CachedChatAnalysis = {
      compositeKey: params.compositeKey,
      userId: params.userId,
      sessionId: params.sessionId,
      modelUsed: params.modelUsed,
      answer: params.answer.trim(),
      finishReason: params.finishReason || "stop",
      createdAt: now,
      expiresAt: now + this.ttlMs,
      contextSig: params.contextSig,
      promptHash: params.promptHash,
      taskType: params.taskType || "GENERAL_TECHNICAL",
    };

    this.cache.set(params.compositeKey, entry);
    return true;
  }

  /**
   * Invalidate all cached entries for a user and session (Mandatory Correction 5)
   */
  public invalidateSession(userId: string, sessionId: string): number {
    let deleted = 0;
    for (const [key, item] of this.cache.entries()) {
      if (item.userId === userId && item.sessionId === sessionId) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const chatAnalysisCache = new ChatAnalysisCache();

/**
 * 4. Non-Screen Chat Request Coalescer (Mandatory Corrections 1, 2, 3)
 * - Atomic leader election before any await
 * - Bounded replay buffer (max 500 chunks / 256 KB)
 * - Late subscriber replay + live stream
 * - Disconnect safety: leader disconnect keeps generation running if followers remain
 * - All subscribers disconnected -> safe abort
 */
export class ChatRequestCoalescer {
  private inFlightMap = new Map<string, ChatInFlightEntry>();
  public readonly MAX_REPLAY_CHUNKS = 500;
  public readonly MAX_REPLAY_BYTES = 256 * 1024; // 256 KB memory ceiling

  /**
   * Synchronous atomic leader election BEFORE the first await (Mandatory Correction 1)
   */
  public acquireLeaderOrFollower(params: {
    compositeKey: string;
    userId: string;
    sessionId: string;
    model: string;
    contextSig: string;
    promptHash: string;
    taskType?: string;
    reqId: string;
    res: Response;
    sendSSE: (data: any) => void;
  }): LeaderElectionResult {
    const existing = this.inFlightMap.get(params.compositeKey);

    if (existing && !existing.isFinished) {
      // Follower path: joins existing in-flight leader synchronously
      const follower: ChatSubscriber = {
        id: params.reqId,
        res: params.res,
        isLeader: false,
        sendSSE: params.sendSSE,
      };
      existing.subscribers.set(params.reqId, follower);

      // Replay start event if already emitted
      if (existing.hasStarted && existing.startPayload) {
        try {
          follower.sendSSE({ ...existing.startPayload, requestId: params.reqId });
        } catch {}
      }

      // Replay accumulated chunk buffer (Mandatory Correction 3)
      for (const chunk of existing.chunkReplayBuffer) {
        try {
          follower.sendSSE({
            type: "chunk",
            text: chunk,
            chunk,
            content: chunk,
            requestId: params.reqId,
          });
        } catch {}
      }

      // If finished during replay
      if (existing.isFinished && existing.donePayload) {
        try {
          follower.sendSSE({ ...existing.donePayload, requestId: params.reqId });
          follower.res.end();
        } catch {}
      }

      return {
        isLeader: false,
        inFlight: existing,
        subscriber: follower,
      };
    }

    // Leader path: atomically creates the in-flight entry
    const abortController = new AbortController();
    const leader: ChatSubscriber = {
      id: params.reqId,
      res: params.res,
      isLeader: true,
      sendSSE: params.sendSSE,
    };

    const inFlight: ChatInFlightEntry = {
      compositeKey: params.compositeKey,
      userId: params.userId,
      sessionId: params.sessionId,
      model: params.model,
      contextSig: params.contextSig,
      promptHash: params.promptHash,
      taskType: params.taskType || "GENERAL_TECHNICAL",
      leaderId: params.reqId,
      subscribers: new Map([[params.reqId, leader]]),
      abortController,
      chunksDispatched: 0,
      hasStarted: false,
      chunkReplayBuffer: [],
      replayByteLength: 0,
      isFinished: false,
      startTime: Date.now(),
    };

    this.inFlightMap.set(params.compositeKey, inFlight);

    return {
      isLeader: true,
      inFlight,
      subscriber: leader,
    };
  }

  public broadcastStart(entry: ChatInFlightEntry, payload: any): void {
    entry.hasStarted = true;
    entry.startPayload = payload;
    for (const [id, sub] of entry.subscribers.entries()) {
      try {
        sub.sendSSE({ ...payload, requestId: id });
      } catch (err) {
        entry.subscribers.delete(id);
      }
    }
  }

  public broadcastChunk(entry: ChatInFlightEntry, chunkText: string): void {
    if (!chunkText) return;
    entry.chunksDispatched++;

    // Bounded replay buffer management (Mandatory Correction 3)
    if (
      entry.chunkReplayBuffer.length < this.MAX_REPLAY_CHUNKS &&
      entry.replayByteLength + chunkText.length < this.MAX_REPLAY_BYTES
    ) {
      entry.chunkReplayBuffer.push(chunkText);
      entry.replayByteLength += chunkText.length;
    }

    for (const [id, sub] of entry.subscribers.entries()) {
      try {
        sub.sendSSE({
          type: "chunk",
          text: chunkText,
          chunk: chunkText,
          content: chunkText,
          requestId: id,
        });
      } catch (err) {
        entry.subscribers.delete(id);
      }
    }
  }

  public broadcastDone(entry: ChatInFlightEntry, payload: any): void {
    entry.isFinished = true;
    entry.donePayload = payload;

    for (const [id, sub] of entry.subscribers.entries()) {
      try {
        sub.sendSSE({ ...payload, requestId: id });
        sub.res.end();
      } catch {}
    }

    // Clean up in-flight lifecycle immediately (never persist replay buffer)
    this.inFlightMap.delete(entry.compositeKey);
  }

  public broadcastError(entry: ChatInFlightEntry, errorPayload: any): void {
    entry.isFinished = true;
    for (const [id, sub] of entry.subscribers.entries()) {
      try {
        sub.sendSSE({
          type: "error",
          requestId: id,
          error: errorPayload.message || "AI generation failed.",
          code: errorPayload.code || "AI_PROVIDER_ERROR",
        });
        sub.res.end();
      } catch {}
    }

    this.inFlightMap.delete(entry.compositeKey);
  }

  /**
   * Handles subscriber disconnect with leader resiliency (Mandatory Correction 2)
   */
  public handleSubscriberDisconnect(
    compositeKey: string,
    subscriberId: string
  ): { allDisconnected: boolean } {
    const entry = this.inFlightMap.get(compositeKey);
    if (!entry) return { allDisconnected: true };

    entry.subscribers.delete(subscriberId);

    // If followers remain, generation MUST continue!
    if (entry.subscribers.size > 0) {
      if (subscriberId === entry.leaderId) {
        // Elect new leader from remaining subscribers
        const nextLeader = entry.subscribers.values().next().value;
        if (nextLeader) {
          nextLeader.isLeader = true;
          entry.leaderId = nextLeader.id;
          console.log(
            `[ChatCoalescer] req=${subscriberId} leader disconnected; transferred leadership to follower=${nextLeader.id}`
          );
        }
      }
      return { allDisconnected: false };
    }

    // If zero active subscribers remain, safely abort stream and clean up
    console.log(
      `[ChatCoalescer] req=${subscriberId} all subscribers disconnected; aborting shared stream`
    );
    entry.abortController.abort();
    this.inFlightMap.delete(compositeKey);
    return { allDisconnected: true };
  }

  public getInFlight(compositeKey: string): ChatInFlightEntry | undefined {
    return this.inFlightMap.get(compositeKey);
  }

  public clear(): void {
    for (const entry of this.inFlightMap.values()) {
      entry.abortController.abort();
    }
    this.inFlightMap.clear();
  }

  public inFlightCount(): number {
    return this.inFlightMap.size;
  }
}

export const chatRequestCoalescer = new ChatRequestCoalescer();

/**
 * 5. Deterministic Skip Decision Engine
 * Evaluates whether an incoming request should GENERATE, REUSE_COMPLETED, or JOIN_EXISTING.
 *
 * Rules:
 * - Screen requests -> delegate to Task 5 (screenAnalysisCache, screenRequestCoalescer)
 * - Non-screen requests -> evaluate chatAnalysisCache and chatRequestCoalescer
 * - If contextSig changed -> GENERATE (CONTEXT_CHANGED)
 * - If new question -> GENERATE (NEW_QUESTION)
 * - If identical request is completed -> REUSE_COMPLETED (DUPLICATE_COMPLETED)
 * - If identical request is in-flight -> JOIN_EXISTING (DUPLICATE_IN_FLIGHT)
 * - If uncertain -> GENERATE (UNCERTAIN_IDENTITY)
 */
export function resolveGenerationDecision(params: {
  userId: string;
  sessionId: string;
  model: string;
  question?: string;
  imageBase64?: string;
  isContinuation?: boolean;
  parentRequestId?: string;
  taskType?: string;
  parentTaskType?: string;
  suggestedDepth?: string;
  requiresCode?: boolean;
  language?: string;
  boundedContext?: any;
  sessionContext?: any;
  taskMetadata?: any;
}): GenerationDecisionResult {
  const isScreen = !!params.imageBase64 && !params.isContinuation;

  // ─── A. SCREEN REQUEST PATH (Strictly delegates to Task 5) ───
  if (isScreen) {
    const { fingerprint } = computeBinaryImageFingerprint(params.imageBase64!);
    const taskMetaForSig = {
      taskType: params.taskType || params.sessionContext?.taskType,
      parentTaskType: params.parentTaskType || params.sessionContext?.parentTaskType,
      boundedContext: params.boundedContext || params.sessionContext?.boundedContext,
    };
    const contextSig = computeServerContextSignature({
      boundedContext: taskMetaForSig.boundedContext,
      sessionContext: params.sessionContext,
      taskMetadata: taskMetaForSig,
    });
    const promptHash = computePromptHash(params.question);

    const screenCompositeKey = [
      `u:${params.userId}`,
      `s:${params.sessionId}`,
      `m:${params.model}`,
      `ctx:${contextSig}`,
      `p:${promptHash}`,
      `fp:${fingerprint}`,
    ].join("|");

    const cachedScreen = screenAnalysisCache.get(screenCompositeKey);
    if (cachedScreen) {
      return {
        decision: 'REUSE_COMPLETED',
        reason: 'SCREEN_CACHE_HIT',
        compositeKey: screenCompositeKey,
        promptHash,
        contextSig,
        cachedAnswer: cachedScreen.answer,
      };
    }

    const inFlightScreen = screenRequestCoalescer.getInFlight(screenCompositeKey);
    if (inFlightScreen && !inFlightScreen.isFinished) {
      return {
        decision: 'JOIN_EXISTING',
        reason: 'SCREEN_IN_FLIGHT',
        compositeKey: screenCompositeKey,
        promptHash,
        contextSig,
      };
    }

    return {
      decision: 'GENERATE',
      reason: 'NEW_QUESTION',
      compositeKey: screenCompositeKey,
      promptHash,
      contextSig,
    };
  }

  // ─── B. NON-SCREEN CHAT PATH ───
  const contextSig = computeServerContextSignature({
    boundedContext: params.boundedContext || params.sessionContext?.boundedContext,
    sessionContext: params.sessionContext,
    taskMetadata: params.taskMetadata,
  });

  const { compositeKey, promptHash } = computeLogicalChatIdentity({
    userId: params.userId,
    sessionId: params.sessionId,
    model: params.model,
    taskType: params.taskType,
    parentTaskType: params.parentTaskType,
    question: params.question,
    suggestedDepth: params.suggestedDepth,
    requiresCode: params.requiresCode,
    language: params.language,
    isContinuation: params.isContinuation,
    contextSig,
  });

  // Continuation requests require live completion (Task 8 bounded)
  if (params.isContinuation) {
    return {
      decision: 'GENERATE',
      reason: 'FOLLOW_UP',
      compositeKey,
      promptHash,
      contextSig,
    };
  }

  // 1. Check Completed Reusable Answer Cache
  const cached = chatAnalysisCache.get(compositeKey);
  if (cached && cached.answer) {
    return {
      decision: 'REUSE_COMPLETED',
      reason: 'DUPLICATE_COMPLETED',
      compositeKey,
      promptHash,
      contextSig,
      cachedAnswer: cached.answer,
    };
  }

  // 2. Check In-Flight Coalescing
  const inFlight = chatRequestCoalescer.getInFlight(compositeKey);
  if (inFlight && !inFlight.isFinished) {
    return {
      decision: 'JOIN_EXISTING',
      reason: 'DUPLICATE_IN_FLIGHT',
      compositeKey,
      promptHash,
      contextSig,
      inFlightEntry: inFlight,
    };
  }

  // 3. Fresh Generation Path
  return {
    decision: 'GENERATE',
    reason: 'NEW_QUESTION',
    compositeKey,
    promptHash,
    contextSig,
  };
}
