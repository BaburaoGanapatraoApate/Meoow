import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

export interface RazorpayOrderCreationParams {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, any>;
}

export interface RazorpayOrderResult {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, any>;
  created_at: number;
}

export interface RazorpayPaymentResult {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  invoice_id: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string | null;
  card_id: string | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  notes: Record<string, any>;
  fee: number;
  tax: number;
  error_code: string | null;
  error_description: string | null;
  created_at: number;
}

export class RazorpayService {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private client: any = null;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || "";
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    this.initClient();
  }

  private initClient(): void {
    if (this.keyId && this.keySecret) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Razorpay = require("razorpay");
        this.client = new Razorpay({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
      } catch (err) {
        console.warn("[RazorpayService] Razorpay SDK initialization warning:", err);
      }
    }
  }

  public isConfigured(): boolean {
    return !!(this.keyId && this.keySecret);
  }

  public isLiveConfigured(): boolean {
    return (
      !!this.keyId &&
      !this.keyId.includes("placeholder") &&
      !!this.keySecret &&
      !this.keySecret.includes("placeholder")
    );
  }

  public getKeyId(): string {
    return this.keyId || "rzp_test_placeholder";
  }

  public getKeySecret(): string {
    return this.keySecret || "default_test_key_secret_for_hmac";
  }

  public getWebhookSecret(): string {
    return this.webhookSecret || "default_test_webhook_secret_for_hmac";
  }

  /**
   * Create an order on Razorpay.
   * Uses live Razorpay API if live credentials are configured, or deterministic mock order if running in test environment.
   */
  public async createOrder(params: RazorpayOrderCreationParams): Promise<RazorpayOrderResult> {
    const currency = params.currency || "INR";

    if (this.isLiveConfigured() && this.client) {
      try {
        const order = await this.client.orders.create({
          amount: params.amountPaise,
          currency,
          receipt: params.receipt,
          notes: params.notes || {},
        });
        return order as RazorpayOrderResult;
      } catch (err: any) {
        console.error("[RazorpayService] Razorpay order creation failed:", err?.error?.description || err?.message || err);
        const error: any = new Error(err?.error?.description || "Failed to create Razorpay order.");
        error.status = 502;
        error.code = "RAZORPAY_PROVIDER_ERROR";
        throw error;
      }
    }

    // Fallback deterministic order generator for test environments without live credentials
    const mockOrderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return {
      id: mockOrderId,
      entity: "order",
      amount: params.amountPaise,
      amount_paid: 0,
      amount_due: params.amountPaise,
      currency,
      receipt: params.receipt,
      status: "created",
      attempts: 0,
      notes: params.notes || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Fetch payment details from Razorpay.
   */
  public async fetchPayment(paymentId: string): Promise<RazorpayPaymentResult | null> {
    if (this.isLiveConfigured() && this.client) {
      try {
        const payment = await this.client.payments.fetch(paymentId);
        return payment as RazorpayPaymentResult;
      } catch (err: any) {
        console.error("[RazorpayService] Razorpay fetch payment failed:", err?.error?.description || err?.message || err);
        return null;
      }
    }
    return null;
  }

  /**
   * Fetch order details from Razorpay.
   */
  public async fetchOrder(orderId: string): Promise<RazorpayOrderResult | null> {
    if (this.isLiveConfigured() && this.client) {
      try {
        const order = await this.client.orders.fetch(orderId);
        return order as RazorpayOrderResult;
      } catch (err: any) {
        console.error("[RazorpayService] Razorpay fetch order failed:", err?.error?.description || err?.message || err);
        return null;
      }
    }
    return null;
  }

  /**
   * Verify Razorpay Checkout signature using HMAC SHA256 and constant-time string comparison.
   * Expected payload format: `${orderId}|${paymentId}`
   */
  public verifyCheckoutSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
    secretOverride?: string;
  }): boolean {
    const secret = params.secretOverride || this.getKeySecret();
    if (!secret) {
      return false;
    }

    try {
      const payload = `${params.orderId}|${params.paymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const expectedBuf = Buffer.from(expectedSignature, "utf8");
      const actualBuf = Buffer.from(params.signature, "utf8");

      if (expectedBuf.length !== actualBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  }

  /**
   * Verify Razorpay Webhook signature using HMAC SHA256 against raw request body.
   */
  public verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string,
    secretOverride?: string
  ): boolean {
    const secret = secretOverride || this.getWebhookSecret();
    if (!secret || !signature) {
      return false;
    }

    try {
      const bodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyBuffer)
        .digest("hex");

      const expectedBuf = Buffer.from(expectedSignature, "utf8");
      const actualBuf = Buffer.from(signature, "utf8");

      if (expectedBuf.length !== actualBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();

