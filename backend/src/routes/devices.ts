import { Router, Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import {
  registerDevice,
  verifyDevice,
  listUserDevices,
  revokeDevice,
  replaceDevice,
} from "../services/deviceService";

const router = Router();

// All device management endpoints require standard user authentication
router.use(authMiddleware);

const registerSchema = z.object({
  deviceId: z.string().min(10).max(255),
  deviceToken: z.string().min(32).max(255),
  deviceName: z.string().max(100).optional(),
  platform: z.string().max(50).optional(),
  osVersion: z.string().max(100).optional(),
  appVersion: z.string().max(50).optional(),
});

const revokeSchema = z.object({
  deviceId: z.string().min(1).max(255),
  reason: z.string().max(255).optional(),
});

const replaceSchema = z.object({
  revokeDeviceId: z.string().min(1).max(255),
  newDevice: registerSchema,
});

/**
 * POST /api/devices/register
 * Register or re-verify current device.
 */
router.post("/register", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: "Device registration payload validation failed.",
      details: parsed.error.issues,
    });
    return;
  }

  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;
  const userAgent = req.headers["user-agent"];

  try {
    const result = await registerDevice(userId, parsed.data, {
      ipAddress: clientIp,
      userAgent,
    });

    if (result.status === "limit_exceeded") {
      res.status(403).json({
        error: "DEVICE_LIMIT_EXCEEDED",
        code: "DEVICE_LIMIT_EXCEEDED",
        message: result.message,
        deviceId: result.deviceId,
        maxDevices: result.maxDevices,
        activeCount: result.activeCount,
        activeDevices: result.activeDevices,
      });
      return;
    }

    if (result.status === "token_mismatch") {
      res.status(409).json({
        error: "DEVICE_TOKEN_MISMATCH",
        code: "DEVICE_TOKEN_MISMATCH",
        message: result.message,
        deviceId: result.deviceId,
      });
      return;
    }

    res.status(200).json({
      success: true,
      status: result.status,
      message: result.message,
      deviceId: result.deviceId,
      maxDevices: result.maxDevices,
      activeCount: result.activeCount,
    });
  } catch (err: any) {
    console.error("Device registration error:", err);
    res.status(err.status || 500).json({
      error: err.code || "INTERNAL_ERROR",
      message: err.message || "Failed to register device.",
    });
  }
});

/**
 * GET /api/devices/check
 * Verify whether provided device headers correspond to an active, valid device.
 */
router.get("/check", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const deviceId = (req.headers["x-device-id"] || req.headers["X-Device-Id"]) as string | undefined;
  const deviceToken = (req.headers["x-device-token"] || req.headers["X-Device-Token"]) as string | undefined;

  if (!deviceId || !deviceToken) {
    res.status(400).json({
      valid: false,
      error: "MISSING_DEVICE_HEADERS",
      message: "X-Device-Id and X-Device-Token headers are required.",
    });
    return;
  }

  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;

  try {
    const result = await verifyDevice(userId, deviceId, deviceToken, clientIp);
    res.status(result.valid ? 200 : 403).json(result);
  } catch (err: any) {
    console.error("Device check error:", err);
    res.status(500).json({
      valid: false,
      error: "INTERNAL_ERROR",
      message: "Failed to verify device.",
    });
  }
});

/**
 * GET /api/devices/list
 * List all devices associated with the current user.
 */
router.get("/list", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const data = await listUserDevices(userId);
    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error("Device listing error:", err);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to list devices.",
    });
  }
});

/**
 * POST /api/devices/revoke
 * Deactivate a registered device.
 */
router.post("/revoke", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = revokeSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: "Device revocation payload validation failed.",
    });
    return;
  }

  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;
  const userAgent = req.headers["user-agent"];

  try {
    const result = await revokeDevice(userId, parsed.data.deviceId, parsed.data.reason, {
      ipAddress: clientIp,
      userAgent,
    });

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (err: any) {
    console.error("Device revocation error:", err);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to deactivate device.",
    });
  }
});

/**
 * POST /api/devices/replace
 * Atomically deactivate an old device and activate the new device.
 */
router.post("/replace", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = replaceSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: "Device replacement payload validation failed.",
      details: parsed.error.issues,
    });
    return;
  }

  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;
  const userAgent = req.headers["user-agent"];

  try {
    const result = await replaceDevice(
      userId,
      parsed.data.revokeDeviceId,
      parsed.data.newDevice,
      {
        ipAddress: clientIp,
        userAgent,
      }
    );

    res.status(200).json(result);
  } catch (err: any) {
    console.error("Device replacement error:", err);
    res.status(err.status || 500).json({
      error: err.code || "INTERNAL_ERROR",
      message: err.message || "Failed to replace device.",
    });
  }
});

export default router;

