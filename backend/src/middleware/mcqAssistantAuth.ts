import { Response, NextFunction } from "express";
import { pool } from "../db/database";
import { AuthenticatedRequest } from "./auth";

export const MCQ_ASSISTANT_ADMIN_EMAIL = "yeolekrushnar@gmail.com";

/** Exact, server-authoritative allowlist for the private MCQ assistant. */
export async function requireMcqAssistantAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
    return;
  }

  try {
    const result = await pool.query(
      "SELECT email, status FROM users WHERE id = $1",
      [req.userId]
    );
    const user = result.rows[0];
    const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";

    if (!user || user.status !== "active" || email !== MCQ_ASSISTANT_ADMIN_EMAIL) {
      res.status(403).json({
        error: "MCQ_ASSISTANT_FORBIDDEN",
        message: "MCQ Assistant access is restricted.",
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Unable to verify MCQ Assistant access.",
    });
  }
}
