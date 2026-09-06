import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  registerUser,
  verifyEmailOtp,
  resendVerificationOtp,
  loginUser,
  getUserById
} from "../services/authService";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import {
  registerLimiter,
  loginLimiter,
  verifyOtpLimiter,
  resendOtpLimiter
} from "../middleware/rateLimiter";

const router = Router();

// Validation Schemas
const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long").trim(),
  email: z.string().email("Invalid email address").max(255, "Email is too long").trim().toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password is too long")
});

const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  otp: z.string().regex(/^\d{6}$/, "Verification code must be a 6-digit number")
});

const resendOtpSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase()
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required")
});

// Helper for Zod validation formatting
function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(", ");
}

// 1. POST /api/auth/register
router.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: formatZodErrors(parseResult.error) });
    return;
  }

  const { name, email, password } = parseResult.data;

  try {
    const result = await registerUser(name, email, password);
    res.status(201).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Failed to register account." : err.message;
    res.status(status).json({ error: message });
  }
});

// 2. POST /api/auth/verify-email
router.post("/verify-email", verifyOtpLimiter, async (req: Request, res: Response) => {
  const parseResult = verifyEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: formatZodErrors(parseResult.error) });
    return;
  }

  const { email, otp } = parseResult.data;

  try {
    const result = await verifyEmailOtp(email, otp);
    res.status(200).json({
      message: "Email verified successfully.",
      token: result.token,
      user: result.user
    });
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Failed to verify email." : err.message;
    res.status(status).json({ error: message });
  }
});

// 3. POST /api/auth/resend-otp
router.post("/resend-otp", resendOtpLimiter, async (req: Request, res: Response) => {
  const parseResult = resendOtpSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: formatZodErrors(parseResult.error) });
    return;
  }

  const { email } = parseResult.data;

  try {
    const result = await resendVerificationOtp(email);
    res.status(200).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Failed to resend verification code." : err.message;
    res.status(status).json({ error: message });
  }
});

// 4. POST /api/auth/login
router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: formatZodErrors(parseResult.error) });
    return;
  }

  const { email, password } = parseResult.data;

  try {
    const result = await loginUser(email, password);
    res.status(200).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Authentication failed." : err.message;
    const response: any = { error: message };
    if (err.requiresVerification) {
      response.requiresVerification = true;
      response.email = err.email;
    }
    res.status(status).json(response);
  }
});

// 5. POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Logged out successfully."
  });
});

// 6. GET /api/auth/me
router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await getUserById(req.userId!);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      credits: user.credits,
      usageMode: user.usageMode || "credits",
      role: user.role || "user",
      status: user.status,
      createdAt: user.createdAt
    });
  } catch {
    res.status(500).json({ error: "Failed to retrieve user profile." });
  }
});

export default router;

