import dotenv from "dotenv";
import { pool } from "../db/database";

dotenv.config();

export type Provider = "groq" | "deepgram";
export type PoolRole = "public" | "admin";
export type CredentialStatus = "HEALTHY" | "COOLDOWN" | "DISABLED";

export const MAX_SAFE_COOLDOWN_SECONDS = 86400; // 24-hour upper sanity limit against corrupt headers
export const DEFAULT_SAFE_COOLDOWN_SECONDS = 20;

export interface ManagedCredential {
  credentialId: string;
  provider: Provider;
  role: PoolRole;
  apiKey: string; // private in-memory, never exposed in logs or diagnostics
  status: CredentialStatus;
  cooldownUntil: number; // epoch ms
  lastUsedAt: number; // epoch ms
  inFlightCount: number;
  totalAttempts: number;
  successfulRequests: number;
  rateLimitCount: number;
  consecutiveFailures: number;
  lastErrorCategory?: string;
  lastErrorMessage?: string;
  lastUsedModel?: string;
}
export interface CredentialLease {
  credentialId: string;
  provider: Provider;
  role: PoolRole;
  apiKey: string;
  release: () => void;
}

export interface SafeCredentialDiagnostic {
  credentialId: string;
  provider: Provider;
  role: PoolRole;
  status: CredentialStatus;
  cooldownRemainingSeconds: number;
  inFlightCount: number;
  totalAttempts: number;
  successfulRequests: number;
  rateLimitCount: number;
  consecutiveFailures: number;
  lastErrorCategory?: string;
  lastUsedModel?: string;
}

export interface PoolDiagnostics {
  groq: {
    publicCount: number;
    adminConfigured: boolean;
    adminIsolationCompromised: boolean;
    credentials: SafeCredentialDiagnostic[];
  };
  deepgram: {
    publicCount: number;
    adminConfigured: boolean;
    adminIsolationCompromised: boolean;
    credentials: SafeCredentialDiagnostic[];
  };
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
  const compRegex =
    /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?!s))?\s*(?:(\d+(?:\.\d+)?)\s*s)?\s*(?:(\d+(?:\.\d+)?)\s*ms)?$/;
  const match = trimmed.match(compRegex);
  if (
    match &&
    (match[1] !== undefined || match[2] !== undefined || match[3] !== undefined || match[4] !== undefined)
  ) {
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
export function extractCooldownSeconds(err: any): number {
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

    // 1. Prefer retry-after
    const rawRetryAfter = getHeader("retry-after");
    if (rawRetryAfter) {
      const parsed = parseDurationString(rawRetryAfter);
      if (parsed !== null && parsed > 0) {
        return Math.min(MAX_SAFE_COOLDOWN_SECONDS, Math.max(1, Math.ceil(parsed)));
      }
    }

    // 2. x-ratelimit-reset-tokens
    const rawResetTokens = getHeader("x-ratelimit-reset-tokens");
    if (rawResetTokens) {
      const parsed = parseDurationString(rawResetTokens);
      if (parsed !== null && parsed > 0) {
        return Math.min(MAX_SAFE_COOLDOWN_SECONDS, Math.max(1, Math.ceil(parsed)));
      }
    }

    // 3. x-ratelimit-reset-requests
    const rawResetRequests = getHeader("x-ratelimit-reset-requests");
    if (rawResetRequests) {
      const parsed = parseDurationString(rawResetRequests);
      if (parsed !== null && parsed > 0) {
        return Math.min(MAX_SAFE_COOLDOWN_SECONDS, Math.max(1, Math.ceil(parsed)));
      }
    }

    // 4. Provider error message
    const msg = err?.message || err?.error?.message || "";
    const tryAgainMatch = msg.match(/try again in\s+([0-9a-z\s\.]+?)(?:\.\s|\.$|\s+need|\s+please|$)/i);
    if (tryAgainMatch && tryAgainMatch[1]) {
      const parsed = parseDurationString(tryAgainMatch[1].trim());
      if (parsed !== null && parsed > 0) {
        return Math.min(MAX_SAFE_COOLDOWN_SECONDS, Math.max(1, Math.ceil(parsed)));
      }
    }
  } catch {}

  return DEFAULT_SAFE_COOLDOWN_SECONDS;
}

export class ProviderKeyPool {
  private credentials = new Map<string, ManagedCredential>();
  private adminIsolationCompromised = {
    groq: false,
    deepgram: false,
  };

  constructor(envSource?: Record<string, string | undefined>) {
    this.initializePool(envSource || process.env);
  }

  /**
   * Initialize pool from environment configuration with deduplication & validation.
   */
  public initializePool(env: Record<string, string | undefined>): void {
    this.credentials.clear();
    this.adminIsolationCompromised = { groq: false, deepgram: false };

    // --- Groq Credentials ---
    const rawGroqConfigs: Array<{ id: string; role: PoolRole; key?: string }> = [
      { id: "groq-public-1", role: "public", key: env.GROQ_API_KEY1 },
      { id: "groq-public-2", role: "public", key: env.GROQ_API_KEY2 },
      { id: "groq-public-3", role: "public", key: env.GROQ_API_KEY3 },
      { id: "groq-public-4", role: "public", key: env.GROQ_API_KEY4 },
      { id: "groq-public-5", role: "public", key: env.GROQ_API_KEY5 },
      { id: "groq-admin", role: "admin", key: env.GROQ_API_KEY_admin },
    ];

    // Optional legacy fallback
    if (env.GROQ_API_KEY && env.GROQ_API_KEY.trim().length > 0) {
      rawGroqConfigs.push({
        id: "groq-public-legacy",
        role: "public",
        key: env.GROQ_API_KEY,
      });
    }

    this.registerProviderCredentials("groq", rawGroqConfigs);

    // --- Deepgram Credentials ---
    const rawDeepgramConfigs: Array<{ id: string; role: PoolRole; key?: string }> = [
      { id: "deepgram-public-1", role: "public", key: env.DEEPGRAM_API_KEY1 },
      { id: "deepgram-public-2", role: "public", key: env.DEEPGRAM_API_KEY2 },
      { id: "deepgram-admin", role: "admin", key: env.DEEPGRAM_API_KEY_admin },
    ];

    // Optional legacy fallback
    if (env.DEEPGRAM_API_KEY && env.DEEPGRAM_API_KEY.trim().length > 0) {
      rawDeepgramConfigs.push({
        id: "deepgram-public-legacy",
        role: "public",
        key: env.DEEPGRAM_API_KEY,
      });
    }

    this.registerProviderCredentials("deepgram", rawDeepgramConfigs);
  }

  /**
   * Register and deduplicate credentials for a given provider.
   */
  private registerProviderCredentials(
    provider: Provider,
    rawConfigs: Array<{ id: string; role: PoolRole; key?: string }>
  ): void {
    // Map secret -> first registered credential ID
    const seenSecrets = new Map<string, { id: string; role: PoolRole }>();

    for (const config of rawConfigs) {
      const rawVal = config.key;
      if (!rawVal || typeof rawVal !== "string") continue;
      const key = rawVal.trim();
      if (key.length === 0) continue;

      const existing = seenSecrets.get(key);
      if (existing) {
        // Check if duplicate is between admin and public
        if (
          (config.role === "admin" && existing.role === "public") ||
          (config.role === "public" && existing.role === "admin")
        ) {
          this.adminIsolationCompromised[provider] = true;
          console.warn(
            `[ProviderPoolWarning] WARNING: ${config.id} duplicates ${existing.id}; admin/public isolation is not independent.`
          );
        } else {
          console.warn(
            `[ProviderPoolWarning] ${config.id} duplicates ${existing.id}; skipping duplicate to prevent capacity inflation.`
          );
        }
        // Deduplication: do not add duplicate into credentials map
        continue;
      }

      seenSecrets.set(key, { id: config.id, role: config.role });

      this.credentials.set(config.id, {
        credentialId: config.id,
        provider,
        role: config.role,
        apiKey: key,
        status: "HEALTHY",
        cooldownUntil: 0,
        lastUsedAt: 0,
        inFlightCount: 0,
        totalAttempts: 0,
        successfulRequests: 0,
        rateLimitCount: 0,
        consecutiveFailures: 0,
      });
    }
  }

  /**
   * Acquire an eligible credential based on provider and user role.
   * Selection strategy:
   * 1. Lowest inFlightCount
   * 2. Oldest lastUsedAt
   * 3. Deterministic credentialId order
   */
  public acquireCredential(options: {
    provider: Provider;
    role: PoolRole;
    excludeIds?: Set<string>;
    model?: string;
  }): CredentialLease | null {
    const { provider, role, excludeIds } = options;
    const now = Date.now();

    // 1. Gather all candidates for provider not in excludeIds
    const poolList: ManagedCredential[] = [];
    for (const cred of this.credentials.values()) {
      if (cred.provider !== provider) continue;
      if (excludeIds && excludeIds.has(cred.credentialId)) continue;

      // Status recovery: if in cooldown and expiry passed, transition to HEALTHY
      if (cred.status === "COOLDOWN") {
        if (cred.cooldownUntil <= now) {
          cred.status = "HEALTHY";
          cred.cooldownUntil = 0;
        } else {
          continue; // still in cooldown
        }
      }

      if (cred.status === "DISABLED") {
        continue;
      }

      poolList.push(cred);
    }

    let candidates: ManagedCredential[] = [];

    if (role === "admin") {
      // Admin request: prefers admin credential first
      const adminCandidates = poolList.filter((c) => c.role === "admin");
      if (adminCandidates.length > 0) {
        candidates = adminCandidates;
      } else {
        // Fallback: eligible public credentials
        candidates = poolList.filter((c) => c.role === "public");
      }
    } else {
      // Normal user request: STRICTLY PUBLIC ONLY
      candidates = poolList.filter((c) => c.role === "public");
    }

    if (candidates.length === 0) {
      return null;
    }

    // 2. Deterministic sort:
    // a. lowest inFlightCount
    // b. oldest lastUsedAt (lowest epoch ms)
    // c. deterministic credentialId string comparison
    candidates.sort((a, b) => {
      if (a.inFlightCount !== b.inFlightCount) {
        return a.inFlightCount - b.inFlightCount;
      }
      if (a.lastUsedAt !== b.lastUsedAt) {
        return a.lastUsedAt - b.lastUsedAt;
      }
      return a.credentialId.localeCompare(b.credentialId);
    });

    const chosen = candidates[0];

    // 3. Lease credential
    chosen.inFlightCount++;
    chosen.lastUsedAt = now;
    chosen.totalAttempts++;

    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        this.releaseCredential(chosen.credentialId);
      }
    };

    return {
      credentialId: chosen.credentialId,
      provider: chosen.provider,
      role: chosen.role,
      apiKey: chosen.apiKey,
      release,
    };
  }

  /**
   * Release a leased credential safely (prevents negative inFlightCount).
   */
  public releaseCredential(credentialId: string): void {
    const cred = this.credentials.get(credentialId);
    if (cred) {
      cred.inFlightCount = Math.max(0, cred.inFlightCount - 1);
    }
  }

  /**
   * Record successful execution on a credential.
   */
  public recordSuccess(credentialId: string, model?: string): void {
    const cred = this.credentials.get(credentialId);
    if (!cred) return;

    cred.successfulRequests++;
    cred.consecutiveFailures = 0;
    cred.status = "HEALTHY";
    if (model) {
      cred.lastUsedModel = model;
    }
  }

  /**
   * Record error on a credential with rigorous classification.
   */
  public recordError(
    credentialId: string,
    err: any,
    context?: {
      retryAfterSeconds?: number;
      model?: string;
      isModelSpecificError?: boolean;
    }
  ): void {
    const cred = this.credentials.get(credentialId);
    if (!cred) return;

    cred.consecutiveFailures++;
    const status = err?.status || err?.statusCode || err?.response?.status;
    const code = err?.code || err?.error?.code || err?.type;
    const msg = (err?.message || err?.error?.message || "").toLowerCase();

    // 1. Client error (400) / Payload Too Large (413) -> do NOT rotate or cooldown
    if (status === 400) {
      cred.lastErrorCategory = "400";
      return;
    }
    if (status === 413 || msg.includes("payload too large") || msg.includes("too large")) {
      cred.lastErrorCategory = "413";
      return;
    }

    // 2. Client Abort / Disconnect -> do not retry loop or alter status
    if (err?.name === "AbortError" || code === "ABORT_ERR" || msg.includes("abort")) {
      cred.lastErrorCategory = "abort";
      return;
    }

    // 3. Authentication failure (401) -> mark DISABLED
    if (status === 401 || code === "invalid_api_key") {
      cred.status = "DISABLED";
      cred.lastErrorCategory = "401";
      return;
    }

    // 4. Forbidden / Authorization (403)
    if (status === 403) {
      if (context?.isModelSpecificError || msg.includes("model permission") || msg.includes("not allowed for model")) {
        cred.lastErrorCategory = "403_model_permission";
        // Do NOT globally disable credential if it is only a model access issue
      } else {
        cred.status = "DISABLED";
        cred.lastErrorCategory = "403";
      }
      return;
    }

    // 5. Rate Limit (429)
    if (
      status === 429 ||
      code === "rate_limit_exceeded" ||
      code === "tokens" ||
      msg.includes("rate limit") ||
      msg.includes("tokens per minute") ||
      msg.includes("itpm")
    ) {
      cred.rateLimitCount++;
      cred.status = "COOLDOWN";
      const seconds = context?.retryAfterSeconds ?? extractCooldownSeconds(err);
      cred.cooldownUntil = Date.now() + seconds * 1000;
      cred.lastErrorCategory = "429";
      return;
    }

    // 6. Timeout (408 / ETIMEDOUT)
    if (status === 408 || code === "ETIMEDOUT" || msg.includes("timeout")) {
      cred.lastErrorCategory = "timeout";
      return;
    }

    // 7. Server / Provider error (5xx)
    if (status >= 500) {
      cred.lastErrorCategory = "5xx";
      return;
    }

    // 8. Network / Socket hangup
    if (code === "ECONNRESET" || code === "ENOTFOUND" || msg.includes("network")) {
      cred.lastErrorCategory = "network";
      return;
    }

    cred.lastErrorCategory = "unknown";
  }

  /**
   * Count currently eligible credentials for a role and provider.
   */
  public getEligibleCount(options: { provider: Provider; role: PoolRole }): number {
    const { provider, role } = options;
    const now = Date.now();
    let count = 0;

    for (const cred of this.credentials.values()) {
      if (cred.provider !== provider) continue;

      if (cred.status === "COOLDOWN") {
        if (cred.cooldownUntil > now) continue;
      }
      if (cred.status === "DISABLED") continue;

      if (role === "admin") {
        count++;
      } else {
        if (cred.role === "public") count++;
      }
    }

    return count;
  }

  /**
   * Return safe diagnostics (ZERO secret values).
   */
  public getDiagnostics(): PoolDiagnostics {
    const now = Date.now();

    const formatCred = (c: ManagedCredential): SafeCredentialDiagnostic => ({
      credentialId: c.credentialId,
      provider: c.provider,
      role: c.role,
      status: c.status === "COOLDOWN" && c.cooldownUntil <= now ? "HEALTHY" : c.status,
      cooldownRemainingSeconds:
        c.status === "COOLDOWN" && c.cooldownUntil > now
          ? Math.ceil((c.cooldownUntil - now) / 1000)
          : 0,
      inFlightCount: c.inFlightCount,
      totalAttempts: c.totalAttempts,
      successfulRequests: c.successfulRequests,
      rateLimitCount: c.rateLimitCount,
      consecutiveFailures: c.consecutiveFailures,
      lastErrorCategory: c.lastErrorCategory,
      lastUsedModel: c.lastUsedModel,
    });

    const groqCreds = Array.from(this.credentials.values())
      .filter((c) => c.provider === "groq")
      .map(formatCred);

    const deepgramCreds = Array.from(this.credentials.values())
      .filter((c) => c.provider === "deepgram")
      .map(formatCred);

    return {
      groq: {
        publicCount: groqCreds.filter((c) => c.role === "public").length,
        adminConfigured: groqCreds.some((c) => c.role === "admin"),
        adminIsolationCompromised: this.adminIsolationCompromised.groq,
        credentials: groqCreds,
      },
      deepgram: {
        publicCount: deepgramCreds.filter((c) => c.role === "public").length,
        adminConfigured: deepgramCreds.some((c) => c.role === "admin"),
        adminIsolationCompromised: this.adminIsolationCompromised.deepgram,
        credentials: deepgramCreds,
      },
    };
  }

  /**
   * Get direct internal credential reference by ID (used for testing state inspections).
   */
  public getCredential(credentialId: string): ManagedCredential | undefined {
    return this.credentials.get(credentialId);
  }
}

// Global Singleton Pool Instance
export const providerKeyPool = new ProviderKeyPool();

// In-memory cache for user role (60s TTL) to prevent Postgres query on every provider selection
const userRoleCache = new Map<string, { role: PoolRole; expiresAt: number }>();

/**
 * Authoritative runtime user role resolver:
 * JWT -> authenticated user ID -> database user lookup -> role === "admin".
 * Never uses client headers, frontend email, or request body.
 */
export async function getAuthoritativeUserRole(userId: string): Promise<PoolRole> {
  if (!userId) return "public";

  const cached = userRoleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.role;
  }

  try {
    const res = await pool.query(
      "SELECT role, status FROM users WHERE id = $1",
      [userId]
    );

    if (res.rows.length === 0) {
      return "public";
    }

    const row = res.rows[0];
    if (row.status !== "active") {
      return "public";
    }

    const role: PoolRole = row.role === "admin" ? "admin" : "public";
    userRoleCache.set(userId, { role, expiresAt: Date.now() + 60 * 1000 });
    return role;
  } catch (err) {
    console.error("[ProviderKeyPool] Failed to resolve user role from database:", err);
    return "public";
  }
}

/**
 * Invalidate user role cache (e.g. after role update).
 */
export function invalidateUserRoleCache(userId?: string): void {
  if (userId) {
    userRoleCache.delete(userId);
  } else {
    userRoleCache.clear();
  }
}
