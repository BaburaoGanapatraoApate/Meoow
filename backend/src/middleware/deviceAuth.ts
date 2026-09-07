import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { verifyDevice } from "../services/deviceService";
import { pool } from "../db/database";

export interface DeviceAuthenticatedRequest extends AuthenticatedRequest {
  deviceId?: string;
}

/**
 * Middleware enforcing valid, active device registration for desktop AI routes.
 */
export async function deviceAuthMiddleware(
  req: DeviceAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Authentication required prior to device verification.",
    });
    return;
  }

  const deviceId = (req.headers["x-device-id"] || req.headers["X-Device-Id"]) as string | undefined;
  const deviceToken = (req.headers["x-device-token"] || req.headers["X-Device-Token"]) as string | undefined;

  // Allow admin bypass if admin calls without device headers
  if (!deviceId || !deviceToken) {
    try {
      const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
      if (userRes.rows[0]?.role === "admin") {
        return next();
      }
    } catch {
      // Ignore and proceed to missing headers error
    }

    res.status(401).json({
      error: "DEVICE_REQUIRED",
      code: "DEVICE_REQUIRED",
      message: "Device identification headers (X-Device-Id and X-Device-Token) are required for desktop AI operations.",
    });
    return;
  }

  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;

  try {
    const result = await verifyDevice(userId, deviceId, deviceToken, clientIp);

    if (!result.valid) {
      if (result.code === "USER_INACTIVE") {
        res.status(403).json({
          error: "USER_INACTIVE",
          code: "USER_INACTIVE",
          message: result.message || "User account is suspended or inactive.",
        });
        return;
      }

      if (result.code === "DEVICE_REVOKED") {
        res.status(403).json({
          error: "DEVICE_REVOKED",
          code: "DEVICE_REVOKED",
          message: result.message || "This device has been deactivated or revoked.",
        });
        return;
      }

      if (result.code === "DEVICE_NOT_REGISTERED") {
        res.status(403).json({
          error: "DEVICE_NOT_REGISTERED",
          code: "DEVICE_NOT_REGISTERED",
          message: result.message || "This device is not registered for this account.",
        });
        return;
      }

      res.status(401).json({
        error: "INVALID_DEVICE_TOKEN",
        code: "INVALID_DEVICE_TOKEN",
        message: result.message || "Invalid device authentication credentials.",
      });
      return;
    }

    req.deviceId = deviceId;
    next();
  } catch (err: any) {
    console.error("Device auth verification error:", err);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to verify device authorization.",
    });
  }
}

