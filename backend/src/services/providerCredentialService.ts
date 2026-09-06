import { pool } from "../db/database";
import { encryptCredential, decryptCredential } from "./encryptionService";

export class ProviderCredentialError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number = 400, code: string = "PROVIDER_CREDENTIAL_ERROR") {
    super(message);
    this.name = "ProviderCredentialError";
    this.status = status;
    this.code = code;
  }
}

export interface UserProviderStatus {
  userId: string;
  hasGroqOverride: boolean;
  hasDeepgramOverride: boolean;
  usageMode: "credits" | "unlimited";
}

/**
 * Resolve Groq API key for a specific user:
 * - If user has an encrypted override in database, decrypt and return it.
 * - Otherwise return the default GROQ_API_KEY from environment.
 */
export async function resolveGroqCredential(userId: string): Promise<string> {
  if (!userId) {
    return process.env.GROQ_API_KEY || "";
  }

  const res = await pool.query(
    `SELECT encrypted_api_key, iv, auth_tag, encryption_version 
     FROM provider_credentials 
     WHERE user_id = $1 AND provider = 'groq'`,
    [userId]
  );

  if (res.rows.length === 0) {
    return process.env.GROQ_API_KEY || "";
  }

  const row = res.rows[0];
  return decryptCredential({
    ciphertext: row.encrypted_api_key,
    iv: row.iv,
    authTag: row.auth_tag,
    version: row.encryption_version,
  });
}

/**
 * Resolve Deepgram API key for a specific user:
 * - If user has an encrypted override in database, decrypt and return it.
 * - Otherwise return the default DEEPGRAM_API_KEY from environment.
 */
export async function resolveDeepgramCredential(userId: string): Promise<string> {
  if (!userId) {
    return process.env.DEEPGRAM_API_KEY || "";
  }

  const res = await pool.query(
    `SELECT encrypted_api_key, iv, auth_tag, encryption_version 
     FROM provider_credentials 
     WHERE user_id = $1 AND provider = 'deepgram'`,
    [userId]
  );

  if (res.rows.length === 0) {
    return process.env.DEEPGRAM_API_KEY || "";
  }

  const row = res.rows[0];
  return decryptCredential({
    ciphertext: row.encrypted_api_key,
    iv: row.iv,
    authTag: row.auth_tag,
    version: row.encryption_version,
  });
}

/**
 * Get sanitized provider override status for a user (zero plaintext keys).
 */
export async function getUserProviderStatus(userId: string): Promise<UserProviderStatus> {
  const userRes = await pool.query(
    "SELECT id, usage_mode FROM users WHERE id = $1",
    [userId]
  );

  if (userRes.rows.length === 0) {
    throw new ProviderCredentialError("User not found.", 404, "USER_NOT_FOUND");
  }

  const user = userRes.rows[0];

  const credsRes = await pool.query(
    "SELECT provider FROM provider_credentials WHERE user_id = $1",
    [userId]
  );

  const providers = new Set(credsRes.rows.map((r) => r.provider));

  return {
    userId: user.id,
    hasGroqOverride: providers.has("groq"),
    hasDeepgramOverride: providers.has("deepgram"),
    usageMode: user.usage_mode || "credits",
  };
}

/**
 * Record an audit log entry inside a database client or pool.
 */
export async function recordAdminAudit(
  client: any,
  adminUserId: string,
  targetUserId: string | null,
  action: string,
  provider?: string | null,
  metadata: Record<string, any> = {}
): Promise<void> {
  await client.query(
    `INSERT INTO admin_audit_logs (admin_user_id, target_user_id, action, provider, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminUserId, targetUserId, action, provider || null, JSON.stringify(metadata)]
  );
}

/**
 * Assign provider overrides atomically.
 * When both Groq and Deepgram overrides are assigned, sets usage_mode = 'unlimited'.
 */
export async function assignProviderOverrides(
  adminUserId: string,
  targetUserId: string,
  payload: {
    groqApiKey?: string;
    deepgramApiKey?: string;
  }
): Promise<UserProviderStatus> {
  const { groqApiKey, deepgramApiKey } = payload;

  if (!groqApiKey && !deepgramApiKey) {
    throw new ProviderCredentialError(
      "At least one provider API key must be provided.",
      400,
      "MISSING_CREDENTIALS"
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock target user
    const userRes = await client.query(
      "SELECT id, name, email, usage_mode FROM users WHERE id = $1 FOR UPDATE",
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      throw new ProviderCredentialError("Target user not found.", 404, "USER_NOT_FOUND");
    }

    const user = userRes.rows[0];
    const previousMode = user.usage_mode;

    // 1. Process Groq key if provided
    if (groqApiKey && groqApiKey.trim().length > 0) {
      const encrypted = encryptCredential(groqApiKey.trim());
      await client.query(
        `INSERT INTO provider_credentials (
          user_id, provider, encrypted_api_key, iv, auth_tag, encryption_version, updated_at
        ) VALUES ($1, 'groq', $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, provider) DO UPDATE SET
          encrypted_api_key = EXCLUDED.encrypted_api_key,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          encryption_version = EXCLUDED.encryption_version,
          updated_at = NOW()`,
        [targetUserId, encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.version]
      );

      await recordAdminAudit(
        client,
        adminUserId,
        targetUserId,
        "provider_override_assigned",
        "groq",
        { keyLength: groqApiKey.trim().length }
      );
    }

    // 2. Process Deepgram key if provided
    if (deepgramApiKey && deepgramApiKey.trim().length > 0) {
      const encrypted = encryptCredential(deepgramApiKey.trim());
      await client.query(
        `INSERT INTO provider_credentials (
          user_id, provider, encrypted_api_key, iv, auth_tag, encryption_version, updated_at
        ) VALUES ($1, 'deepgram', $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, provider) DO UPDATE SET
          encrypted_api_key = EXCLUDED.encrypted_api_key,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          encryption_version = EXCLUDED.encryption_version,
          updated_at = NOW()`,
        [targetUserId, encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.version]
      );

      await recordAdminAudit(
        client,
        adminUserId,
        targetUserId,
        "provider_override_assigned",
        "deepgram",
        { keyLength: deepgramApiKey.trim().length }
      );
    }

    // 3. Inspect active providers after update
    const activeCredsRes = await client.query(
      "SELECT provider FROM provider_credentials WHERE user_id = $1",
      [targetUserId]
    );
    const activeProviders = new Set(activeCredsRes.rows.map((r) => r.provider));
    const hasBoth = activeProviders.has("groq") && activeProviders.has("deepgram");

    // 4. If both providers exist, enable unlimited mode
    let finalUsageMode = user.usage_mode;
    if (hasBoth && user.usage_mode !== "unlimited") {
      await client.query(
        "UPDATE users SET usage_mode = 'unlimited', updated_at = NOW() WHERE id = $1",
        [targetUserId]
      );
      finalUsageMode = "unlimited";

      await recordAdminAudit(
        client,
        adminUserId,
        targetUserId,
        "unlimited_enabled",
        null,
        { reason: "Assigned both Groq and Deepgram overrides", previousMode }
      );
    }

    await client.query("COMMIT");

    return {
      userId: targetUserId,
      hasGroqOverride: activeProviders.has("groq"),
      hasDeepgramOverride: activeProviders.has("deepgram"),
      usageMode: finalUsageMode as "credits" | "unlimited",
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove provider override(s) atomically.
 * When overrides are removed, resets user's usage_mode back to 'credits'.
 */
export async function removeProviderOverrides(
  adminUserId: string,
  targetUserId: string,
  providerToRemove?: "groq" | "deepgram"
): Promise<UserProviderStatus> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock target user
    const userRes = await client.query(
      "SELECT id, usage_mode FROM users WHERE id = $1 FOR UPDATE",
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      throw new ProviderCredentialError("Target user not found.", 404, "USER_NOT_FOUND");
    }

    const user = userRes.rows[0];
    const previousMode = user.usage_mode;

    if (providerToRemove) {
      // Delete specific provider
      await client.query(
        "DELETE FROM provider_credentials WHERE user_id = $1 AND provider = $2",
        [targetUserId, providerToRemove]
      );

      await recordAdminAudit(
        client,
        adminUserId,
        targetUserId,
        "provider_override_removed",
        providerToRemove,
        {}
      );
    } else {
      // Delete all providers
      await client.query(
        "DELETE FROM provider_credentials WHERE user_id = $1",
        [targetUserId]
      );

      await recordAdminAudit(
        client,
        adminUserId,
        targetUserId,
        "provider_override_removed",
        "all",
        {}
      );
    }

    // Check remaining providers
    const remainingCredsRes = await client.query(
      "SELECT provider FROM provider_credentials WHERE user_id = $1",
      [targetUserId]
    );
    const activeProviders = new Set(remainingCredsRes.rows.map((r) => r.provider));
    const hasBoth = activeProviders.has("groq") && activeProviders.has("deepgram");

    // Reset usage_mode to credits if user no longer has both overrides
    let finalUsageMode = user.usage_mode;
    if (!hasBoth && user.usage_mode === "unlimited") {
      await client.query(
        "UPDATE users SET usage_mode = 'credits', updated_at = NOW() WHERE id = $1",
        [targetUserId]
      );
      finalUsageMode = "credits";

      await recordAdminAudit(
        client,
        adminUserId,
        targetUserId,
        "unlimited_disabled",
        null,
        { reason: "Provider override removed", previousMode }
      );
    }

    await client.query("COMMIT");

    return {
      userId: targetUserId,
      hasGroqOverride: activeProviders.has("groq"),
      hasDeepgramOverride: activeProviders.has("deepgram"),
      usageMode: finalUsageMode as "credits" | "unlimited",
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Manually update usage mode for a user.
 */
export async function setUserUsageMode(
  adminUserId: string,
  targetUserId: string,
  mode: "credits" | "unlimited"
): Promise<{ userId: string; usageMode: string }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      "SELECT id, usage_mode FROM users WHERE id = $1 FOR UPDATE",
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      throw new ProviderCredentialError("Target user not found.", 404, "USER_NOT_FOUND");
    }

    const previousMode = userRes.rows[0].usage_mode;

    await client.query(
      "UPDATE users SET usage_mode = $1, updated_at = NOW() WHERE id = $2",
      [mode, targetUserId]
    );

    await recordAdminAudit(
      client,
      adminUserId,
      targetUserId,
      mode === "unlimited" ? "unlimited_enabled" : "unlimited_disabled",
      null,
      { previousMode, manual: true }
    );

    await client.query("COMMIT");

    return { userId: targetUserId, usageMode: mode };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

