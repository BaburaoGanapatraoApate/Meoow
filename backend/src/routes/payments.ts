import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentOrders,
  PaymentServiceError,
} from "../services/paymentService";
import { getActivePackages } from "../services/packageService";

const router = Router();

// Validation Schemas
const createOrderSchema = z.object({
  packageId: z.string().max(100).optional(),
  notes: z.record(z.string(), z.any()).optional(),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required").max(100),
  paymentId: z.string().min(1, "Payment ID is required").max(100),
  signature: z.string().min(1, "Signature is required").max(2048),
});

const ordersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Helper for Zod validation error formatting
function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(", ");
}

/**
 * 1. GET /api/payments/packages
 * Retrieve available active credit packages for purchase.
 */
router.get("/packages", authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const packages = await getActivePackages();
    res.status(200).json({
      packages: packages.map((p) => ({
        id: p.code,
        name: p.name,
        credits: p.credits,
        amountPaise: p.amountPaise,
        currency: p.currency,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      error: "FETCH_PACKAGES_FAILED",
      message: "Failed to retrieve available credit packages.",
    });
  }
});

/**
 * 2. POST /api/payments/razorpay/order
 * Authenticated order creation with strictly server-controlled pricing.
 */
router.post("/razorpay/order", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: formatZodErrors(parsed.error),
    });
    return;
  }

  try {
    const result = await createPaymentOrder(userId, parsed.data);
    res.status(201).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Failed to create payment order." : err.message;
    res.status(status).json({
      error: err.code || "PAYMENT_ORDER_FAILED",
      message,
    });
  }
});

/**
 * 3. POST /api/payments/razorpay/verify
 * Authenticated payment verification with ownership, HMAC validation, and atomic credit fulfillment.
 */
router.post("/razorpay/verify", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = verifyPaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: formatZodErrors(parsed.error),
    });
    return;
  }

  try {
    const result = await verifyPayment(userId, parsed.data);
    res.status(200).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Failed to verify payment." : err.message;
    res.status(status).json({
      error: err.code || "PAYMENT_VERIFICATION_FAILED",
      message,
    });
  }
});

/**
 * 4. POST /api/payments/razorpay/webhook
 * Unauthenticated webhook listener with raw-body HMAC SHA256 validation and atomic credit fulfillment.
 */
router.post("/razorpay/webhook", async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"] as string;

  if (!signature) {
    res.status(400).json({
      error: "MISSING_SIGNATURE",
      message: "Missing X-Razorpay-Signature header.",
    });
    return;
  }

  const rawBody = (req as any).rawBody || req.body;

  try {
    const result = await handleWebhook(rawBody, signature);
    res.status(200).json({ status: "ok", ...result });
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({
      error: err.code || "WEBHOOK_FAILED",
      message: err.message || "Webhook processing failed.",
    });
  }
});

/**
 * 5. GET /api/payments/orders
 * Retrieve payment history for the authenticated user.
 */
router.get("/orders", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const parseResult = ordersQuerySchema.safeParse(req.query);
  const limit = parseResult.success ? parseResult.data.limit : 50;

  try {
    const orders = await getPaymentOrders(userId, limit);
    res.status(200).json({ orders });
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Failed to retrieve payment orders." : err.message;
    res.status(status).json({
      error: err.code || "FETCH_ORDERS_FAILED",
      message,
    });
  }
});

export default router;
