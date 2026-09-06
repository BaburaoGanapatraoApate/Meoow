import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes recommended for GCM
const CURRENT_VERSION = 1;

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
}

export class EncryptionError extends Error {
  code: string;

  constructor(message: string, code: string = "ENCRYPTION_ERROR") {
    super(message);
    this.name = "EncryptionError";
    this.code = code;
  }
}

/**
 * Resolve a 32-byte Buffer key from the environment or override.
 */
function resolveEncryptionKey(keyOverride?: string): Buffer {
  const rawKey = keyOverride || process.env.PROVIDER_ENCRYPTION_KEY;

  if (!rawKey || rawKey.trim().length === 0) {
    throw new EncryptionError(
      "PROVIDER_ENCRYPTION_KEY environment variable is not configured.",
      "MISSING_ENCRYPTION_KEY"
    );
  }

  const trimmed = rawKey.trim();

  // If 64-char hex string, decode directly to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  // Otherwise derive a deterministic 32-byte key using SHA-256
  return crypto.createHash("sha256").update(trimmed).digest();
}

/**
 * Encrypt sensitive credential using AES-256-GCM.
 */
export function encryptCredential(
  plaintext: string,
  keyOverride?: string
): EncryptedData {
  if (!plaintext || typeof plaintext !== "string") {
    throw new EncryptionError("Cannot encrypt empty or non-string credential.", "INVALID_INPUT");
  }

  const key = resolveEncryptionKey(keyOverride);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    version: CURRENT_VERSION,
  };
}

/**
 * Decrypt credential using AES-256-GCM with authentication tag validation.
 */
export function decryptCredential(
  data: EncryptedData,
  keyOverride?: string
): string {
  if (!data || !data.ciphertext || !data.iv || !data.authTag) {
    throw new EncryptionError("Invalid encrypted payload structure.", "INVALID_PAYLOAD");
  }

  const key = resolveEncryptionKey(keyOverride);
  const iv = Buffer.from(data.iv, "hex");
  const authTag = Buffer.from(data.authTag, "hex");

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data.ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err: any) {
    throw new EncryptionError(
      "Failed to decrypt credential. Key mismatch or data corrupted.",
      "DECRYPTION_FAILED"
    );
  }
}

