import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
  };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Authentication required. Missing or malformed Authorization header."
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      error: "Server configuration error."
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"]
    }) as jwt.JwtPayload;

    if (
      !payload ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)
    ) {
      res.status(401).json({
        error: "Invalid token payload.",
        code: "INVALID_TOKEN"
      });
      return;
    }

    req.userId = payload.sub;
    req.user = { id: payload.sub };

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({
        error: "Session expired. Please log in again.",
        code: "TOKEN_EXPIRED"
      });
      return;
    }

    res.status(401).json({
      error: "Invalid authentication token.",
      code: "INVALID_TOKEN"
    });
  }
}

