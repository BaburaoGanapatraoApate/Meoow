import { pool } from "../db/database";

export interface CreditBalanceResult {
  credits: number;
  usageMode: "credits" | "unlimited";
  status: string;
}

export interface CreditConsumptionResult {
  success: boolean;
  remainingCredits: number;
  usageMode: "credits" | "unlimited";
  transactionId?: string;
}

export interface CreditTransactionRecord {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: string;
}

export class InsufficientCreditsError extends Error {
  status: number;
  code: string;

  constructor(message: string = "You do not have enough credits.") {
    super(message);
    this.name = "InsufficientCreditsError";
    this.status = 402;
    this.code = "INSUFFICIENT_CREDITS";
  }
}

/**
 * Retrieve the current server-authoritative credit balance and usage mode for a user.
 */
export async function getCreditBalance(userId: string): Promise<CreditBalanceResult> {
  const result = await pool.query(
    "SELECT id, credits, usage_mode, status FROM users WHERE id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    const err: any = new Error("User not found.");
    err.status = 404;
    throw err;
  }

  const row = result.rows[0];
  return {
    credits: row.credits,
    usageMode: row.usage_mode || "credits",
    status: row.status
  };
}

/**
 * Atomically consume exactly 1 credit for a successful AI answer.
 * 
 * Guarantees:
 * - Atomic execution via PostgreSQL row locking (SELECT ... FOR UPDATE).
 * - Credits will never become negative under any concurrent load.
 * - In 'unlimited' mode, 0 credits are deducted and 0 transactions are created.
 * - In 'credits' mode, balance decrement and credit_transactions ledger insertion are atomically committed.
 */
export async function consumeCredit(
  userId: string,
  options?: { description?: string }
): Promise<CreditConsumptionResult> {
  const description = options?.description || "AI answer generated";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Acquire row-level lock on the user record
    const userRes = await client.query(
      "SELECT id, credits, usage_mode, status FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      const err: any = new Error("User not found.");
      err.status = 404;
      throw err;
    }

    const user = userRes.rows[0];

    if (user.status !== "active") {
      await client.query("ROLLBACK");
      const err: any = new Error("Account is not active.");
      err.status = 403;
      throw err;
    }

    const usageMode = user.usage_mode || "credits";

    // 1. Unlimited usage mode
    if (usageMode === "unlimited") {
      await client.query("COMMIT");
      return {
        success: true,
        remainingCredits: user.credits,
        usageMode: "unlimited"
      };
    }

    // 2. Credits mode: verify sufficient balance
    if (user.credits < 1) {
      await client.query("ROLLBACK");
      throw new InsufficientCreditsError();
    }

    // 3. Atomically decrement balance by 1
    const newBalance = user.credits - 1;
    await client.query(
      "UPDATE users SET credits = $1, updated_at = NOW() WHERE id = $2",
      [newBalance, userId]
    );

    // 4. Atomically insert audit ledger entry
    const txRes = await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, -1, 'ai_answer', $2)
       RETURNING id`,
      [userId, description]
    );

    await client.query("COMMIT");

    return {
      success: true,
      remainingCredits: newBalance,
      usageMode: "credits",
      transactionId: txRes.rows[0]?.id
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure if already aborted/committed
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reserve 1 credit for an AI answer generation.
 * Alias for consumeCredit to support the reservation-finalization pattern.
 */
export async function reserveCredit(
  userId: string,
  options?: { description?: string }
): Promise<CreditConsumptionResult> {
  return consumeCredit(userId, options);
}

/**
 * Refund a reserved credit if a streaming answer failed or was aborted before generating a valid answer.
 */
export async function refundCredit(
  userId: string,
  transactionId?: string,
  reason: string = "AI generation failed/aborted"
): Promise<{ success: boolean; newBalance: number }> {
  if (!transactionId) {
    // If no transaction was recorded (e.g. unlimited mode), nothing to refund
    const balance = await getCreditBalance(userId);
    return { success: true, newBalance: balance.credits };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock user row
    const userRes = await client.query(
      "SELECT id, credits, usage_mode FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("User not found.");
    }

    const user = userRes.rows[0];
    const newBalance = user.credits + 1;

    // Increment user balance back by 1
    await client.query(
      "UPDATE users SET credits = $1, updated_at = NOW() WHERE id = $2",
      [newBalance, userId]
    );

    // Remove the unfinalized deduction transaction record from ledger
    await client.query(
      "DELETE FROM credit_transactions WHERE id = $1 AND user_id = $2",
      [transactionId, userId]
    );

    await client.query("COMMIT");
    return { success: true, newBalance };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieve transaction history for an authenticated user.
 */
export async function getCreditTransactions(
  userId: string,
  limit: number = 50
): Promise<CreditTransactionRecord[]> {
  const result = await pool.query(
    `SELECT id, amount, type, description, created_at as "createdAt"
     FROM credit_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

