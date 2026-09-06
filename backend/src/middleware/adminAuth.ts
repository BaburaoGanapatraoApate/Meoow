import { Response, NextFunction } from "express";
import { pool } from "../db/database";
import { AuthenticatedRequest } from "./auth";

export interface AdminRequest extends AuthenticatedRequest {
  adminUser?: {
    id: string;
    role: string;
  };
}

/**
 * Server-side authorization middleware enforcing role === 'admin'.
 */
export async function requireAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Authentication required.",
    });
    return;
  }

  try {
    const userRes = await pool.query(
      "SELECT id, role, status FROM users WHERE id = $1",
      [userId]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "User account not found.",
      });
      return;
    }

    const user = userRes.rows[0];

    if (user.status !== "active") {
      res.status(403).json({
        error: "FORBIDDEN",
        message: "Account is suspended.",
      });
      return;
    }

    if (user.role !== "admin") {
      res.status(403).json({
        error: "FORBIDDEN",
        message: "Admin privileges required.",
      });
      return;
    }

    req.adminUser = {
      id: user.id,
      role: user.role,
    };

    next();
  } catch (err: any) {
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to verify admin privileges.",
    });
  }
}

