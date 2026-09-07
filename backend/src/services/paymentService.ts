import { pool } from "../db/database";
import { razorpayService } from "./razorpayService";
import { getPackageByCode } from "./packageService";

export interface PaymentOrderRecord {
  id: string;
  userId: string;
  provider: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountPaise: number;
  currency: string;
  status: "created" | "attempted" | "paid" | "failed" | "refunded";
  packageId: string | null;
  receipt: string | null;
  notes: Record<string, any>;
  creditsFulfilledAt: string | null;
  creditsAwarded: number;
  createdAt: string;
  updatedAt: string;
}

export class PaymentServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number = 400, code: string = "PAYMENT_ERROR") {
    super(message);
    this.name = "PaymentServiceError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Create a new payment order tied to a server-controlled credit package.
 * Strictly server-authoritative: client can only provide a valid package code.
 */
export async function createPaymentOrder(
  userId: string,
  options?: {
    packageId?: string;
    notes?: Record<string, any>;
  }
): Promise<{
  success: boolean;
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string;
  packageId: string;
  credits: number;
}> {
  const packageCode = options?.packageId || "credits_40";

  // 1. Resolve package from database (fallback to default standard package if unrecognized)
  let pkg = await getPackageByCode(packageCode);
  if (!pkg) {
    pkg = await getPackageByCode("credits_40");
  }
  if (!pkg) {
    throw new PaymentServiceError("The requested credit package does not exist.", 400, "INVALID_PACKAGE");
  }
  if (!pkg.active) {
    throw new PaymentServiceError("The requested credit package is no longer available.", 400, "INACTIVE_PACKAGE");
  }

  if (pkg.isTest) {
    const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
    if (userRes.rows[0]?.role !== "admin") {
      throw new PaymentServiceError("Test packages are restricted to authorized admin accounts.", 403, "PACKAGE_RESTRICTED");
    }
  }

  const amountPaise = pkg.amountPaise;
  const currency = pkg.currency || "INR";
  const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 2. Create order on Razorpay (or deterministic mock if offline test environment)
  const razorpayOrder = await razorpayService.createOrder({
    amountPaise,
    currency,
    receipt,
    notes: {
      userId,
      packageId: pkg.code,
      credits: pkg.credits,
      ...(options?.notes || {}),
    },
  });

  // 3. Persist payment order in Neon database
  await pool.query(
    `INSERT INTO payment_orders (
      user_id, provider, razorpay_order_id, amount_paise, currency, status, package_id, receipt, notes
    ) VALUES ($1, 'razorpay', $2, $3, $4, 'created', $5, $6, $7)`,
    [
      userId,
      razorpayOrder.id,
      amountPaise,
      currency,
      pkg.code,
      receipt,
      JSON.stringify(options?.notes || {}),
    ]
  );

  return {
    success: true,
    orderId: razorpayOrder.id,
    amount: amountPaise,
    amountPaise,
    currency,
    keyId: razorpayService.getKeyId(),
    packageId: pkg.code,
    credits: pkg.credits,
  };
}

/**
 * Internal atomic fulfillment helper.
 * Must be called within an active database transaction where row locks have been obtained.
 * Guarantees exactly-once credit fulfillment and audit logging.
 */
async function fulfillPaymentOrderInTransaction(
  client: any,
  order: any,
  paymentId: string,
  signature: string | null
): Promise<{
  creditsAwarded: number;
  newBalance: number;
  alreadyFulfilled: boolean;
}> {
  // If already marked fulfilled, do nothing (idempotent)
  if (order.credits_fulfilled_at) {
    const userRes = await client.query("SELECT credits FROM users WHERE id = $1", [order.user_id]);
    return {
      creditsAwarded: 0,
      newBalance: userRes.rows[0]?.credits ?? 0,
      alreadyFulfilled: true,
    };
  }

  // 1. Resolve package credits from database
  let creditsToAdd = 0;
  let packageName = "Credit Package";
  if (order.package_id) {
    const pkgRes = await client.query(
      "SELECT name, credits FROM credit_packages WHERE code = $1",
      [order.package_id]
    );
    if (pkgRes.rows.length > 0) {
      creditsToAdd = pkgRes.rows[0].credits;
      packageName = pkgRes.rows[0].name;
    }
  }

  // Fallback if package code not found directly: default to 40 credits for 10000 paise
  if (creditsToAdd <= 0) {
    creditsToAdd = order.amount_paise >= 10000 ? Math.floor(order.amount_paise / 250) : 40;
  }

  // 2. Lock user record
  const userRes = await client.query(
    "SELECT id, credits, usage_mode, status FROM users WHERE id = $1 FOR UPDATE",
    [order.user_id]
  );

  if (userRes.rows.length === 0) {
    throw new PaymentServiceError("User associated with payment not found.", 404, "USER_NOT_FOUND");
  }

  const user = userRes.rows[0];
  const newBalance = user.credits + creditsToAdd;

  // 3. Increment user credits
  await client.query(
    "UPDATE users SET credits = $1, updated_at = NOW() WHERE id = $2",
    [newBalance, order.user_id]
  );

  // 4. Record single purchase audit entry in credit_transactions ledger
  const description = `Purchased ${creditsToAdd} credits (${packageName}) - Order: ${order.razorpay_order_id}, Payment: ${paymentId}`;
  await client.query(
    `INSERT INTO credit_transactions (user_id, amount, type, description)
     VALUES ($1, $2, 'purchase', $3)`,
    [order.user_id, creditsToAdd, description]
  );

  // 5. Update payment order to paid and mark credits_fulfilled_at
  await client.query(
    `UPDATE payment_orders
     SET status = 'paid',
         razorpay_payment_id = COALESCE($1, razorpay_payment_id),
         razorpay_signature = COALESCE($2, razorpay_signature),
         credits_fulfilled_at = NOW(),
         credits_awarded = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [paymentId, signature, creditsToAdd, order.id]
  );

  return {
    creditsAwarded: creditsToAdd,
    newBalance,
    alreadyFulfilled: false,
  };
}

/**
 * Verify checkout payment and atomically fulfill purchased credits.
 * 
 * Guarantees:
 * - Strict payment ownership check (order.user_id === userId).
 * - HMAC-SHA256 signature verification.
 * - Provider payment cross-verification when live API active.
 * - Atomic database transaction with row locks.
 * - Idempotency: Duplicate calls never double-credit (adds exactly 0 additional credits).
 * - Source of truth audit ledger entry in credit_transactions.
 */
export async function verifyPayment(
  userId: string,
  data: {
    orderId: string;
    paymentId: string;
    signature: string;
    secretOverride?: string;
  }
): Promise<{
  success: boolean;
  orderId: string;
  paymentId: string;
  status: string;
  creditsAwarded: number;
  newBalance?: number;
  alreadyVerified?: boolean;
  alreadyFulfilled?: boolean;
}> {
  const { orderId, paymentId, signature, secretOverride } = data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Lock payment order row
    const orderRes = await client.query(
      `SELECT id, user_id, package_id, amount_paise, currency, status, credits_fulfilled_at, razorpay_payment_id, razorpay_order_id
       FROM payment_orders
       WHERE razorpay_order_id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new PaymentServiceError("Payment order not found.", 404, "ORDER_NOT_FOUND");
    }

    const order = orderRes.rows[0];

    // 2. Enforce strict payment ownership
    if (order.user_id !== userId) {
      await client.query("ROLLBACK");
      throw new PaymentServiceError(
        "You do not have permission to verify this payment.",
        403,
        "PAYMENT_OWNERSHIP_ERROR"
      );
    }

    // 3. Idempotent check: If already paid & fulfilled, return success with 0 additional credits
    if (order.status === "paid" && order.credits_fulfilled_at) {
      const userRes = await client.query("SELECT credits FROM users WHERE id = $1", [userId]);
      await client.query("COMMIT");
      return {
        success: true,
        orderId,
        paymentId: order.razorpay_payment_id || paymentId,
        status: "paid",
        creditsAwarded: 0,
        newBalance: userRes.rows[0]?.credits,
        alreadyVerified: true,
        alreadyFulfilled: true,
      };
    }

    // 4. Verify HMAC-SHA256 signature
    const isValidSignature = razorpayService.verifyCheckoutSignature({
      orderId,
      paymentId,
      signature,
      secretOverride,
    });

    if (!isValidSignature) {
      await client.query(
        `UPDATE payment_orders
         SET status = 'failed', error_details = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ error: "Invalid payment signature" }), order.id]
      );
      await client.query("COMMIT");
      throw new PaymentServiceError(
        "Invalid payment signature.",
        400,
        "INVALID_PAYMENT_SIGNATURE"
      );
    }

    // 5. If live Razorpay client is active, query payment details for cross-validation
    const providerPayment = await razorpayService.fetchPayment(paymentId);
    if (providerPayment) {
      if (providerPayment.order_id && providerPayment.order_id !== orderId) {
        await client.query("ROLLBACK");
        throw new PaymentServiceError("Order ID mismatch on provider payment.", 400, "ORDER_MISMATCH");
      }
      if (providerPayment.amount && providerPayment.amount !== order.amount_paise) {
        await client.query("ROLLBACK");
        throw new PaymentServiceError("Payment amount mismatch.", 400, "AMOUNT_MISMATCH");
      }
      if (providerPayment.currency && providerPayment.currency !== order.currency) {
        await client.query("ROLLBACK");
        throw new PaymentServiceError("Payment currency mismatch.", 400, "CURRENCY_MISMATCH");
      }
    }

    // 6. Fulfill payment credits atomically within the transaction
    const fulfillmentResult = await fulfillPaymentOrderInTransaction(
      client,
      order,
      paymentId,
      signature
    );

    await client.query("COMMIT");

    return {
      success: true,
      orderId,
      paymentId,
      status: "paid",
      creditsAwarded: fulfillmentResult.creditsAwarded,
      newBalance: fulfillmentResult.newBalance,
      alreadyFulfilled: fulfillmentResult.alreadyFulfilled,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Handle incoming Razorpay webhook events with raw-body signature verification
 * and atomic payment fulfillment.
 */
export async function handleWebhook(
  rawBody: string | Buffer,
  signature: string,
  secretOverride?: string
): Promise<{ received: boolean; event: string; orderId?: string; creditsAwarded?: number }> {
  // 1. Verify webhook signature against raw request body
  const isValid = razorpayService.verifyWebhookSignature(rawBody, signature, secretOverride);
  if (!isValid) {
    throw new PaymentServiceError("Invalid webhook signature.", 400, "INVALID_WEBHOOK_SIGNATURE");
  }

  // 2. Parse payload
  let payload: any;
  try {
    const text = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    payload = JSON.parse(text);
  } catch {
    throw new PaymentServiceError("Malformed webhook JSON payload.", 400, "INVALID_WEBHOOK_PAYLOAD");
  }

  const eventName = payload.event || "unknown";
  const paymentEntity = payload.payload?.payment?.entity;
  const orderEntity = payload.payload?.order?.entity;
  const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
  const razorpayPaymentId = paymentEntity?.id;

  if (!razorpayOrderId) {
    return { received: true, event: eventName };
  }

  // 3. Process payment event in database
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderRes = await client.query(
      `SELECT id, user_id, package_id, amount_paise, currency, status, credits_fulfilled_at, razorpay_order_id, razorpay_payment_id, webhook_events
       FROM payment_orders
       WHERE razorpay_order_id = $1
       FOR UPDATE`,
      [razorpayOrderId]
    );

    if (orderRes.rows.length === 0) {
      await client.query("COMMIT");
      return { received: true, event: eventName, orderId: razorpayOrderId };
    }

    const order = orderRes.rows[0];
    const eventsArray = Array.isArray(order.webhook_events) ? order.webhook_events : [];
    eventsArray.push({
      event: eventName,
      receivedAt: new Date().toISOString(),
      paymentId: razorpayPaymentId,
    });

    let creditsAwarded = 0;

    if (eventName === "payment.captured" || eventName === "order.paid") {
      // Execute atomic fulfillment if not already fulfilled
      const fulfillment = await fulfillPaymentOrderInTransaction(
        client,
        order,
        razorpayPaymentId || order.razorpay_payment_id || `pay_${Date.now()}`,
        null
      );
      creditsAwarded = fulfillment.creditsAwarded;

      await client.query(
        `UPDATE payment_orders
         SET webhook_events = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(eventsArray), order.id]
      );
    } else if (eventName === "payment.failed") {
      await client.query(
        `UPDATE payment_orders
         SET status = 'failed',
             razorpay_payment_id = COALESCE($1, razorpay_payment_id),
             webhook_events = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [razorpayPaymentId || null, JSON.stringify(eventsArray), order.id]
      );
    }

    await client.query("COMMIT");

    return {
      received: true,
      event: eventName,
      orderId: razorpayOrderId,
      creditsAwarded,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieve payment orders for an authenticated user.
 */
export async function getPaymentOrders(
  userId: string,
  limit: number = 50
): Promise<PaymentOrderRecord[]> {
  const result = await pool.query(
    `SELECT id, user_id as "userId", provider, razorpay_order_id as "razorpayOrderId",
            razorpay_payment_id as "razorpayPaymentId", amount_paise as "amountPaise",
            currency, status, package_id as "packageId", receipt, notes,
            credits_fulfilled_at as "creditsFulfilledAt", credits_awarded as "creditsAwarded",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM payment_orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}
