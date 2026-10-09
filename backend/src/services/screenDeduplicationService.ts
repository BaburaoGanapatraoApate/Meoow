import crypto from "crypto";
import { Response } from "express";

export interface CachedScreenAnalysis {
  compositeKey: string;
  userId: string;
  sessionId: string;
  modelUsed: string;
  answer: string;
  finishReason: string;
  createdAt: number;
  expiresAt: number;
  fingerprint: string;
  contextSig: string;
  promptHash: string;
}
export interface Subscriber {
  id: string;
  res: Response;
  isLeader: boolean;
  sendSSE: (data: any) => void;
}

export interface InFlightEntry {
  compositeKey: string;
  userId: string;
  sessionId: string;
  model: string;
  fingerprint: string;
  contextSig: string;
  promptHash: string;
  leaderId: string;
  subscribers: Map<string, Subscriber>;
  abortController: AbortController;
  chunksDispatched: number;
  hasStarted: boolean;
  startPayload?: any;
  chunkReplayBuffer: string[];
  isFinished: boolean;
  donePayload?: any;
  reservation?: any;
  startTime: number;
}

export interface LeaderElectionResult {
  isLeader: boolean;
  inFlight: InFlightEntry;
  subscriber: Subscriber;
}

/**
 * Normalizes an image payload by stripping data URL prefixes and whitespace,
 * then converts it into a raw Buffer of binary image bytes.
 */
export function normalizeImagePayload(imageBase64: string): Buffer {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return Buffer.alloc(0);
  }
  let clean = imageBase64.trim();
  const commaIdx = clean.indexOf(",");
  if (commaIdx !== -1 && clean.slice(0, commaIdx).includes("base64")) {
    clean = clean.slice(commaIdx + 1).trim();
  }
  return Buffer.from(clean, "base64");
}

/**
 * Computes a deterministic SHA-256 fingerprint from the actual binary image bytes.
 * Identical binary image payloads produce identical fingerprints regardless of data URL formatting.
 */
export function computeBinaryImageFingerprint(imageBase64: string): { fingerprint: string; byteLength: number } {
  const binaryBuffer = normalizeImagePayload(imageBase64);
  const fingerprint = crypto.createHash("sha256").update(binaryBuffer).digest("hex");
  return {
    fingerprint,
    byteLength: binaryBuffer.length,
  };
}

/**
 * Server-authoritative context signature derivation.
 *
 * Derives a deterministic cryptographic hash of the actual bounded interview context
 * and candidate profile used by the backend for this request.
 * Client-provided contextVersion cannot by itself authorize cache/coalescing reuse.
 */
export function computeServerContextSignature(params: {
  boundedContext?: any;
  sessionContext?: any;
  taskMetadata?: any;
}): string {
  const bc = params.boundedContext || params.taskMetadata?.boundedContext || params.sessionContext?.boundedContext;
  const sc = params.sessionContext;

  const parts: string[] = [];

  if (bc) {
    if (bc.activeThread) {
      parts.push(`thread:${bc.activeThread.parentTopic || ""}:${bc.activeThread.taskType || ""}`);
      if (Array.isArray(bc.activeThread.decisions)) {
        parts.push(`decisions:${bc.activeThread.decisions.join(";")}`);
      }
    }
    if (bc.screenObservation) {
      parts.push(`obs:${bc.screenObservation.problem || ""}`);
      if (Array.isArray(bc.screenObservation.entities)) {
        parts.push(`entities:${bc.screenObservation.entities.join(";")}`);
      }
    }
    if (Array.isArray(bc.recentTurns)) {
      const lastTurns = bc.recentTurns.slice(-3).map((t: any) => `${t.speaker || ""}:${t.text || ""}`);
      parts.push(`turns:${lastTurns.join("|")}`);
    }
    if (bc.candidateProfile) {
      parts.push(`cand:${bc.candidateProfile.role || ""}:${(bc.candidateProfile.skills || []).join(",")}`);
    }
  }

  // Include session context anchor
  if (sc) {
    parts.push(`role:${sc.jobTitle || sc.job_title || ""}`);
    parts.push(`round:${sc.interviewRound || sc.interview_round || ""}`);
  }

  const rawContextString = parts.length > 0 ? parts.join("||") : "empty_context";
  return crypto.createHash("sha256").update(rawContextString).digest("hex").slice(0, 16);
}

/**
 * Normalizes question prompt and returns a SHA-256 hash.
 */
export function computePromptHash(question?: string): string {
  if (!question || typeof question !== "string") {
    return crypto.createHash("sha256").update("default_question").digest("hex").slice(0, 16);
  }
  const normalized = question.trim().toLowerCase().replace(/\s+/g, " ");
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Builds the canonical multi-dimensional composite key.
 * Format: user:{userId}:sess:{sessionId}:m:{model}:csig:{contextSig}:p:{promptHash}:img:{fingerprint}
 */
export function buildCompositeKey(params: {
  userId: string;
  sessionId?: string;
  model: string;
  contextSig: string;
  promptHash: string;
  fingerprint: string;
}): string {
  const sessionScope = params.sessionId && params.sessionId.trim().length > 0
    ? params.sessionId.trim()
    : "default_session";
  return `user:${params.userId}:sess:${sessionScope}:m:${params.model}:csig:${params.contextSig}:p:${params.promptHash}:img:${params.fingerprint}`;
}

/**
 * Short-Lived Bounded Result Cache
 * - TTL: 60 seconds (configurable)
 * - Max Size: 50 entries (LRU eviction)
 * - Strictly stores completed successful answers
 * - Never stores raw images
 * - User/session isolated
 */
export class ScreenAnalysisCache {
  private cache = new Map<string, CachedScreenAnalysis>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(options?: { maxEntries?: number; defaultTtlMs?: number }) {
    this.maxEntries = options?.maxEntries ?? 50;
    this.defaultTtlMs = options?.defaultTtlMs ?? 60 * 1000; // 60s
  }

  public get(compositeKey: string): CachedScreenAnalysis | null {
    const entry = this.cache.get(compositeKey);
    if (!entry) return null;

    const now = Date.now();
    if (entry.expiresAt <= now) {
      this.cache.delete(compositeKey);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.cache.delete(compositeKey);
    this.cache.set(compositeKey, entry);
    return entry;
  }

  public set(params: {
    compositeKey: string;
    userId: string;
    sessionId?: string;
    modelUsed: string;
    answer: string;
    finishReason: string;
    isComplete?: boolean;
    isError?: boolean;
    fingerprint: string;
    contextSig: string;
    promptHash: string;
    ttlMs?: number;
  }): boolean {
    // Only cache completely successful, non-error, non-empty answers
    if (params.isError || !params.isComplete || params.finishReason !== "stop" || !params.answer.trim()) {
      return false;
    }

    this.purgeExpired();

    if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    const ttl = params.ttlMs ?? this.defaultTtlMs;

    this.cache.set(params.compositeKey, {
      compositeKey: params.compositeKey,
      userId: params.userId,
      sessionId: params.sessionId || "default_session",
      modelUsed: params.modelUsed,
      answer: params.answer.trim(),
      finishReason: params.finishReason,
      createdAt: now,
      expiresAt: now + ttl,
      fingerprint: params.fingerprint,
      contextSig: params.contextSig,
      promptHash: params.promptHash,
    });

    return true;
  }

  public delete(compositeKey: string): boolean {
    return this.cache.delete(compositeKey);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    this.purgeExpired();
    return this.cache.size;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (v.expiresAt <= now) {
        this.cache.delete(k);
      }
    }
  }
}

/**
 * ScreenRequestCoalescer
 *
 * Implements synchronous, atomic leader election and in-flight request coalescing.
 * Exactly ONE caller becomes leader per composite key.
 * Followers subscribe to the leader's stream and receive chunks and done events.
 * Handles subscriber disconnects without breaking remaining followers.
 */
export class ScreenRequestCoalescer {
  private inFlightMap = new Map<string, InFlightEntry>();

  /**
   * Synchronously get-or-create an in-flight entry BEFORE any async operations.
   * Exactly ONE caller receives isLeader === true.
   */
  public acquireLeaderOrFollower(params: {
    compositeKey: string;
    userId: string;
    sessionId?: string;
    model: string;
    fingerprint: string;
    contextSig: string;
    promptHash: string;
    reqId: string;
    res: Response;
    sendSSE: (data: any) => void;
  }): LeaderElectionResult {
    let inFlight = this.inFlightMap.get(params.compositeKey);

    if (!inFlight) {
      // Leader path
      const abortController = new AbortController();
      inFlight = {
        compositeKey: params.compositeKey,
        userId: params.userId,
        sessionId: params.sessionId || "default_session",
        model: params.model,
        fingerprint: params.fingerprint,
        contextSig: params.contextSig,
        promptHash: params.promptHash,
        leaderId: params.reqId,
        subscribers: new Map(),
        abortController,
        chunksDispatched: 0,
        hasStarted: false,
        chunkReplayBuffer: [],
        isFinished: false,
        startTime: Date.now(),
      };

      const subscriber: Subscriber = {
        id: params.reqId,
        res: params.res,
        isLeader: true,
        sendSSE: params.sendSSE,
      };

      inFlight.subscribers.set(params.reqId, subscriber);
      this.inFlightMap.set(params.compositeKey, inFlight);

      return {
        isLeader: true,
        inFlight,
        subscriber,
      };
    }

    // Follower path: an in-flight request already exists
    const subscriber: Subscriber = {
      id: params.reqId,
      res: params.res,
      isLeader: false,
      sendSSE: params.sendSSE,
    };

    inFlight.subscribers.set(params.reqId, subscriber);

    // If stream already started, immediately replay start event and buffered chunks
    if (inFlight.hasStarted) {
      try {
        subscriber.sendSSE({
          ...(inFlight.startPayload || {
            type: "start",
            parentRequestId: undefined,
            isContinuation: false,
            source: "screen",
          }),
          requestId: params.reqId,
        });
      } catch (err) {
        console.warn(`[Coalescer] Error sending start replay to follower ${params.reqId}:`, err);
      }

      for (const chunkText of inFlight.chunkReplayBuffer) {
        try {
          subscriber.sendSSE({
            type: "chunk",
            text: chunkText,
            chunk: chunkText,
            content: chunkText,
            requestId: params.reqId,
          });
        } catch (err) {
          console.warn(`[Coalescer] Error sending chunk replay to follower ${params.reqId}:`, err);
        }
      }
    }

    // If stream already completed before follower registration
    if (inFlight.isFinished && inFlight.donePayload) {
      try {
        subscriber.sendSSE({
          ...inFlight.donePayload,
          requestId: params.reqId,
        });
        if (!subscriber.res.writableEnded) {
          subscriber.res.end();
        }
      } catch (err) {
        console.warn(`[Coalescer] Error sending done replay to follower ${params.reqId}:`, err);
      }
    }

    return {
      isLeader: false,
      inFlight,
      subscriber,
    };
  }

  /**
   * Broadcasts a start event to all active subscribers.
   */
  public broadcastStart(inFlight: InFlightEntry, data: any): void {
    inFlight.hasStarted = true;
    inFlight.startPayload = data;
    for (const sub of inFlight.subscribers.values()) {
      try {
        sub.sendSSE({
          ...data,
          requestId: sub.id,
        });
      } catch (err) {
        console.warn(`[Coalescer] Error sending start to subscriber ${sub.id}:`, err);
      }
    }
  }

  /**
   * Broadcasts a streaming chunk to all active subscribers.
   */
  public broadcastChunk(inFlight: InFlightEntry, chunkText: string): void {
    inFlight.chunksDispatched++;
    inFlight.chunkReplayBuffer.push(chunkText);
    for (const sub of inFlight.subscribers.values()) {
      try {
        sub.sendSSE({
          type: "chunk",
          text: chunkText,
          chunk: chunkText,
          content: chunkText,
          requestId: sub.id,
        });
      } catch (err) {
        console.warn(`[Coalescer] Error sending chunk to subscriber ${sub.id}:`, err);
      }
    }
  }

  /**
   * Broadcasts the completion done event to all active subscribers and ends their responses.
   */
  public broadcastDone(inFlight: InFlightEntry, doneData: any): void {
    inFlight.isFinished = true;
    inFlight.donePayload = doneData;
    for (const sub of inFlight.subscribers.values()) {
      try {
        sub.sendSSE({
          ...doneData,
          requestId: sub.id,
        });
        if (!sub.res.writableEnded) {
          sub.res.end();
        }
      } catch (err) {
        console.warn(`[Coalescer] Error sending done to subscriber ${sub.id}:`, err);
      }
    }
    this.inFlightMap.delete(inFlight.compositeKey);
  }

  /**
   * Broadcasts an error event to all active subscribers and ends their responses.
   */
  public broadcastError(inFlight: InFlightEntry, errorData: any): void {
    inFlight.isFinished = true;
    for (const sub of inFlight.subscribers.values()) {
      try {
        sub.sendSSE({
          type: "error",
          requestId: sub.id,
          error: errorData.message || "AI generation failed. Please try again.",
          code: errorData.code || "AI_PROVIDER_ERROR",
        });
        if (!sub.res.writableEnded) {
          sub.res.end();
        }
      } catch (err) {
        console.warn(`[Coalescer] Error sending error to subscriber ${sub.id}:`, err);
      }
    }
    this.inFlightMap.delete(inFlight.compositeKey);
  }

  /**
   * Handles subscriber disconnect.
   * - Follower disconnect: removes follower from subscribers. Does NOT abort the shared stream.
   * - Leader disconnect: removes leader. If followers remain, generation continues so followers receive answer.
   * - If ALL subscribers disconnect: triggers abortController on the shared stream.
   * Returns: { allDisconnected: boolean; remainingSubscribers: number }
   */
  public handleSubscriberDisconnect(
    compositeKey: string,
    subscriberId: string
  ): { allDisconnected: boolean; remainingSubscribers: number } {
    const inFlight = this.inFlightMap.get(compositeKey);
    if (!inFlight) {
      return { allDisconnected: true, remainingSubscribers: 0 };
    }

    inFlight.subscribers.delete(subscriberId);
    const remaining = inFlight.subscribers.size;

    if (remaining === 0) {
      // All subscribers have disconnected -> safely abort the underlying provider generation
      if (!inFlight.isFinished) {
        inFlight.abortController.abort();
      }
      this.inFlightMap.delete(compositeKey);
      return { allDisconnected: true, remainingSubscribers: 0 };
    }

    return { allDisconnected: false, remainingSubscribers: remaining };
  }

  public getInFlight(compositeKey: string): InFlightEntry | undefined {
    return this.inFlightMap.get(compositeKey);
  }

  public getInFlightCount(): number {
    return this.inFlightMap.size;
  }

  public clear(): void {
    for (const entry of this.inFlightMap.values()) {
      entry.abortController.abort();
    }
    this.inFlightMap.clear();
  }
}

// Global singleton instances
export const screenAnalysisCache = new ScreenAnalysisCache();
export const screenRequestCoalescer = new ScreenRequestCoalescer();

/**
 * Detects whether a screen question is drilling down into candidate background, projects, or experience.
 */
export function isResumeDrilldownQuestion(question?: string): boolean {
  if (!question || typeof question !== "string") return false;
  const q = question.toLowerCase();
  const keywords = [
    "project",
    "xgboost",
    "internship",
    "experience",
    "resume",
    "background",
    "why did you",
    "tell me about",
    "your work",
    "your role",
    "architecture you built",
    "your approach in",
  ];
  return keywords.some((k) => q.includes(k));
}

/**
 * Extracts compact, relevant candidate resume context when needed for screen questions.
 * Does NOT blindly remove resume text for drilldowns; avoids raw 15KB dumps for general screen analysis.
 */
export function extractRelevantResumeContext(
  sessionContext?: any,
  question?: string
): string | null {
  if (!sessionContext) return null;
  const resumeText = (sessionContext.resumeText || sessionContext.resume_text || "").trim();
  const notes = (sessionContext.notes || "").trim();
  const boundedContext = sessionContext.boundedContext;

  if (!resumeText && !notes && !boundedContext?.candidateProfile) {
    return null;
  }

  const isDrilldown = isResumeDrilldownQuestion(question);

  if (isDrilldown && resumeText) {
    // Return relevant resume text up to 2000 characters
    return resumeText.slice(0, 2000).trim();
  }

  // General screen analysis: return concise profile summary
  const parts: string[] = [];
  if (boundedContext?.candidateProfile) {
    const cp = boundedContext.candidateProfile;
    if (cp.role) parts.push(`Role: ${cp.role}`);
    if (Array.isArray(cp.skills) && cp.skills.length > 0) parts.push(`Skills: ${cp.skills.slice(0, 8).join(", ")}`);
    if (Array.isArray(cp.keyProjects) && cp.keyProjects.length > 0) parts.push(`Projects: ${cp.keyProjects.slice(0, 3).join("; ")}`);
  } else if (resumeText) {
    // First 400 characters (headline / core summary)
    parts.push(resumeText.slice(0, 400).trim());
  }

  return parts.length > 0 ? parts.join(" | ") : null;
}
