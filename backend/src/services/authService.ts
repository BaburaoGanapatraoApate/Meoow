import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db/database";
import { sendOtpEmail } from "./brevoService";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "";
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  credits: number;
  usageMode?: "credits" | "unlimited";
  role?: "user" | "admin";
  status?: string;
  createdAt?: string;
}

export interface AuthResult {
  token: string;
  user: UserResponse;
}

// 1. Password Hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 2. OTP Cryptographic Helpers
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// 3. Register User
export async function registerUser(name: string, rawEmail: string, password: string): Promise<{ userId: string; email: string; message: string; requiresVerification: boolean }> {
  const email = normalizeEmail(rawEmail);
  const trimmedName = name.trim();

  const existingUserRes = await pool.query(
    "SELECT id, email_verified FROM users WHERE email = $1",
    [email]
  );

  let userId: string;
  const passwordHash = await hashPassword(password);

  if (existingUserRes.rows.length > 0) {
    const existing = existingUserRes.rows[0];
    if (existing.email_verified) {
      const err: any = new Error("An account with this email already exists.");
      err.status = 409;
      throw err;
    }

    // Unverified account re-registering: update credentials & name
    userId = existing.id;
    await pool.query(
      "UPDATE users SET name = $1, password_hash = $2, updated_at = NOW() WHERE id = $3",
      [trimmedName, passwordHash, userId]
    );

    // Invalidate prior unused email verification OTPs
    await pool.query(
      "UPDATE otp_codes SET used_at = NOW() WHERE user_id = $1 AND purpose = 'email_verification' AND used_at IS NULL",
      [userId]
    );
  } else {
    // New user creation
    const insertUserRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, email_verified, credits, status)
       VALUES ($1, $2, $3, FALSE, 0, 'active')
       RETURNING id`,
      [trimmedName, email, passwordHash]
    );
    userId = insertUserRes.rows[0].id;
  }

  // Generate OTP and store hashed code
  const plainOtp = generateOtp();
  const codeHash = hashOtp(plainOtp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_codes (user_id, email, code_hash, purpose, expires_at, attempts)
     VALUES ($1, $2, $3, 'email_verification', $4, 0)`,
    [userId, email, codeHash, expiresAt]
  );

  // Trigger Brevo transactional email
  await sendOtpEmail({
    toEmail: email,
    toName: trimmedName,
    otp: plainOtp,
    purpose: "email verification"
  });

  return {
    userId,
    email,
    message: "Registration successful. A verification code has been sent to your email.",
    requiresVerification: true
  };
}

// 4. Verify Email OTP & Award Signup Bonus (+30 credits)
export async function verifyEmailOtp(rawEmail: string, rawOtp: string): Promise<AuthResult> {
  const email = normalizeEmail(rawEmail);
  const otp = rawOtp.trim();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock user row
    const userRes = await client.query(
      "SELECT id, name, email, email_verified, credits, usage_mode, role, status FROM users WHERE email = $1 FOR UPDATE",
      [email]
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      const err: any = new Error("Invalid email or verification code.");
      err.status = 400;
      throw err;
    }

    const user = userRes.rows[0];

    if (user.email_verified) {
      await client.query("ROLLBACK");
      const err: any = new Error("Email is already verified. Please log in.");
      err.status = 400;
      throw err;
    }

    // Find latest unused OTP
    const otpRes = await client.query(
      `SELECT id, code_hash, expires_at, attempts
       FROM otp_codes
       WHERE user_id = $1 AND purpose = 'email_verification' AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [user.id]
    );

    if (otpRes.rows.length === 0) {
      await client.query("ROLLBACK");
      const err: any = new Error("No active verification code found. Please request a new code.");
      err.status = 400;
      throw err;
    }

    const otpRecord = otpRes.rows[0];

    // Check expiry
    if (new Date() > new Date(otpRecord.expires_at)) {
      await client.query("ROLLBACK");
      const err: any = new Error("Verification code has expired. Please request a new code.");
      err.status = 400;
      throw err;
    }

    // Check attempt limits
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await client.query("ROLLBACK");
      const err: any = new Error("Too many failed attempts. Please request a new verification code.");
      err.status = 400;
      throw err;
    }

    // Check OTP hash match
    const candidateHash = hashOtp(otp);
    if (candidateHash !== otpRecord.code_hash) {
      // Increment attempt counter within transaction
      await client.query(
        "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1",
        [otpRecord.id]
      );
      await client.query("COMMIT");

      const remainingAttempts = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1);
      const err: any = new Error(
        remainingAttempts > 0
          ? `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`
          : "Invalid verification code. Maximum attempts reached. Please request a new code."
      );
      err.status = 400;
      throw err;
    }

    // Correct OTP: Mark OTP as used
    await client.query(
      "UPDATE otp_codes SET used_at = NOW() WHERE id = $1",
      [otpRecord.id]
    );

    // Mark user verified and award exactly 30 signup credits
    await client.query(
      `UPDATE users
       SET email_verified = TRUE, credits = credits + 30, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Create credit transaction audit record
    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, 30, 'signup_bonus', 'Initial signup bonus credits')`,
      [user.id]
    );

    await client.query("COMMIT");

    // Generate JWT access token
    const token = generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
        credits: user.credits + 30,
        usageMode: user.usage_mode || "credits",
        role: user.role || "user",
      }
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure if already committed/aborted
    }
    throw err;
  } finally {
    client.release();
  }
}

// 5. Resend OTP
export async function resendVerificationOtp(rawEmail: string): Promise<{ message: string }> {
  const email = normalizeEmail(rawEmail);

  const userRes = await pool.query(
    "SELECT id, name, email_verified FROM users WHERE email = $1",
    [email]
  );

  // Prevent account enumeration by returning generic success if user does not exist or already verified
  if (userRes.rows.length === 0 || userRes.rows[0].email_verified) {
    return { message: "If this account is eligible for verification, a new code has been sent." };
  }

  const user = userRes.rows[0];

  // Check resend cooldown
  const lastOtpRes = await pool.query(
    `SELECT created_at FROM otp_codes
     WHERE user_id = $1 AND purpose = 'email_verification'
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );

  if (lastOtpRes.rows.length > 0) {
    const elapsed = Date.now() - new Date(lastOtpRes.rows[0].created_at).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      const err: any = new Error(`Please wait ${waitSeconds} seconds before requesting a new code.`);
      err.status = 429;
      throw err;
    }
  }

  // Invalidate previous active OTPs
  await pool.query(
    "UPDATE otp_codes SET used_at = NOW() WHERE user_id = $1 AND purpose = 'email_verification' AND used_at IS NULL",
    [user.id]
  );

  // Generate new OTP
  const plainOtp = generateOtp();
  const codeHash = hashOtp(plainOtp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_codes (user_id, email, code_hash, purpose, expires_at, attempts)
     VALUES ($1, $2, $3, 'email_verification', $4, 0)`,
    [user.id, email, codeHash, expiresAt]
  );

  // Send via Brevo
  await sendOtpEmail({
    toEmail: email,
    toName: user.name,
    otp: plainOtp,
    purpose: "email verification"
  });

  return { message: "A new verification code has been sent to your email." };
}

// 6. Login User
export async function loginUser(rawEmail: string, password: string): Promise<AuthResult> {
  const email = normalizeEmail(rawEmail);

  const userRes = await pool.query(
    "SELECT id, name, email, password_hash, email_verified, credits, usage_mode, role, status FROM users WHERE email = $1",
    [email]
  );

  if (userRes.rows.length === 0) {
    const err: any = new Error("Invalid email or password.");
    err.status = 401;
    throw err;
  }

  const user = userRes.rows[0];

  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    const err: any = new Error("Invalid email or password.");
    err.status = 401;
    throw err;
  }

  if (user.status !== "active") {
    const err: any = new Error("Your account is currently suspended. Please contact support.");
    err.status = 403;
    throw err;
  }

  if (!user.email_verified) {
    const err: any = new Error("Email not verified. Please verify your email before logging in.");
    err.status = 403;
    err.requiresVerification = true;
    err.email = user.email;
    throw err;
  }

  // Update last login timestamp
  await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

  const token = generateToken(user.id);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      credits: user.credits,
      usageMode: user.usage_mode || "credits",
      role: user.role || "user",
    }
  };
}

// 7. Get Current User by ID
export async function getUserById(userId: string): Promise<UserResponse | null> {
  const userRes = await pool.query(
    "SELECT id, name, email, email_verified, credits, usage_mode, role, status, created_at FROM users WHERE id = $1",
    [userId]
  );

  if (userRes.rows.length === 0) {
    return null;
  }

  const user = userRes.rows[0];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.email_verified,
    credits: user.credits,
    usageMode: user.usage_mode || "credits",
    role: user.role || "user",
    status: user.status,
    createdAt: user.created_at
  };
}

// 8. Generate JWT Token
export function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not defined.");
  }
  return jwt.sign({ sub: userId }, secret, { algorithm: "HS256", expiresIn: "7d" });
}

