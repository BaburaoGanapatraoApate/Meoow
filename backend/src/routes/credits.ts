import { Router, Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import {
  getCreditBalance,
  getCreditTransactions
} from "../services/creditService";

const router = Router();

// All credit endpoints require authentication
router.use(authMiddleware);

const transactionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

// 1. GET /api/credits/balance
router.get("/balance", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const balance = await getCreditBalance(userId);
    res.status(200).json({
      credits: balance.credits,
      usageMode: balance.usageMode
    });
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Failed to retrieve credit balance." : err.message;
    res.status(status).json({ error: message });
  }
});

// 2. GET /api/credits/transactions
router.get("/transactions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const parseResult = transactionQuerySchema.safeParse(req.query);
    const limit = parseResult.success ? parseResult.data.limit : 50;

    const transactions = await getCreditTransactions(userId, limit);
    res.status(200).json({
      transactions
    });
  } catch (err: any) {
    const status = err.status || 500;
    const message = status === 500 ? "Failed to retrieve transactions." : err.message;
    res.status(status).json({ error: message });
  }
});

export default router;

