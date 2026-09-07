import crypto from "crypto";
import { pool } from "../db/database";

export interface DeviceMetadata {
  deviceId: string;
  deviceToken: string;
  deviceName?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  osVersion: string | null;
  appVersion: string | null;
  status: "active" | "revoked" | "deactivated";
  lastSeenAt: string;
  createdAt: string;
  revokedAt: string | null;
  replacementCount: number;
}

export interface RegisterDeviceResult {
  success: boolean;
  status: "active" | "limit_exceeded" | "token_mismatch";
  message: string;
  deviceId: string;
  maxDevices?: number;
  activeCount?: number;
  activeDevices?: Array<{
    id: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    osVersion: string | null;
    appVersion: string | null;
    lastSeenAt: string;
    createdAt: string;
  }>;
}

export interface VerifyDeviceResult {
  valid: boolean;
  code?: "DEVICE_NOT_REGISTERED" | "DEVICE_REVOKED" | "INVALID_DEVICE_TOKEN" | "USER_INACTIVE";
  message?: string;
}

/**
 * Hash a plain device token using SHA-256.
 */
export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Compare a stored SHA-256 hash with a plain token in constant time.
 */
export function verifyDeviceToken(storedHash: string | null | undefined, plainToken: string): boolean {
  if (!storedHash || !plainToken) return false;
  const computedHash = hashDeviceToken(plainToken);
  try {
    const storedBuf = Buffer.from(storedHash, "utf8");
    const computedBuf = Buffer.from(computedHash, "utf8");
    if (storedBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, computedBuf);
  } catch {
    return false;
  }
}

/**
 * Register or re-verify a device for an authenticated user.
 * Thread-safe using row locking on the user record.
 */
export async function registerDevice(
  userId: string,
  data: DeviceMetadata,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<RegisterDeviceResult> {
  const { deviceId, deviceToken, deviceName = "Windows PC", platform = "win32", osVersion, appVersion } = data;
  const ip = context?.ipAddress || null;
  const userAgent = context?.userAgent || null;

  if (!deviceId || typeof deviceId !== "string" || deviceId.trim().length === 0) {
    throw new Error("Invalid device ID provided.");
  }
  if (!deviceToken || typeof deviceToken !== "string" || deviceToken.length < 32) {
    throw new Error("Invalid device token provided. Must be at least 32 characters.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 1. Lock user row to serialize concurrent device registrations for this user
    const userRes = await client.query(
      "SELECT id, role, usage_mode, status, max_devices FROM users WHERE id = $1 FOR UPDATE;",
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      const err: any = new Error("User account not found.");
      err.status = 404;
      throw err;
    }

    const user = userRes.rows[0];
    if (user.status !== "active") {
      await client.query("ROLLBACK;");
      const err: any = new Error("User account is suspended or inactive.");
      err.status = 403;
      throw err;
    }

    const maxDevices = Number(user.max_devices) || 2;

    // 2. Check if this specific device is already registered for this user
    const existingDeviceRes = await client.query(
      "SELECT * FROM devices WHERE user_id = $1 AND device_id = $2 FOR UPDATE;",
      [userId, deviceId]
    );

    if (existingDeviceRes.rows.length > 0) {
      const existing = existingDeviceRes.rows[0];

      if (existing.status === "active") {
        // Check if device token matches
        if (verifyDeviceToken(existing.device_token_hash, deviceToken)) {
          // Token matches: Update metadata and last seen
          await client.query(
            `UPDATE devices 
             SET last_seen_at = NOW(),
                 device_name = COALESCE($1, device_name),
                 platform = COALESCE($2, platform),
                 os_version = COALESCE($3, os_version),
                 app_version = COALESCE($4, app_version),
                 last_ip = COALESCE($5, last_ip),
                 updated_at = NOW()
             WHERE id = $6;`,
            [deviceName, platform, osVersion, appVersion, ip, existing.id]
          );

          await client.query("COMMIT;");
          return {
            success: true,
            status: "active",
            message: "Device already registered and verified.",
            deviceId,
            maxDevices,
          };
        } else {
          // Token mismatch: Device exists but client has a different token (e.g. reinstall or unauthorized attempt)
          await client.query("ROLLBACK;");
          return {
            success: false,
            status: "token_mismatch",
            message: "Security token mismatch for this registered device. Please use device replacement.",
            deviceId,
            maxDevices,
          };
        }
      }
      // If previously revoked/deactivated, check limit before reactivating below
    }

    // 3. Count current active devices
    const activeCountRes = await client.query(
      "SELECT COUNT(*)::int AS count FROM devices WHERE user_id = $1 AND status = 'active';",
      [userId]
    );
    const activeCount = activeCountRes.rows[0]?.count || 0;

    if (activeCount >= maxDevices) {
      // Limit exceeded: Retrieve active devices so client can display DeviceLimitModal
      const activeDevicesRes = await client.query(
        `SELECT id, device_id AS "deviceId", device_name AS "deviceName", 
                platform, os_version AS "osVersion", app_version AS "appVersion", 
                last_seen_at AS "lastSeenAt", created_at AS "createdAt"
         FROM devices 
         WHERE user_id = $1 AND status = 'active'
         ORDER BY last_seen_at DESC;`,
        [userId]
      );

      await client.query(
        `INSERT INTO device_audit_logs (user_id, device_id, action, ip_address, user_agent, metadata)
         VALUES ($1, $2, 'limit_exceeded', $3, $4, $5);`,
        [
          userId,
          deviceId,
          ip,
          userAgent,
          JSON.stringify({ activeCount, maxDevices, requestedDeviceName: deviceName }),
        ]
      );

      await client.query("COMMIT;");
      return {
        success: false,
        status: "limit_exceeded",
        message: `Device limit reached (${activeCount}/${maxDevices}). Please deactivate an unused device to continue.`,
        deviceId,
        maxDevices,
        activeCount,
        activeDevices: activeDevicesRes.rows,
      };
    }

    // 4. Register or Reactivate device
    const tokenHash = hashDeviceToken(deviceToken);

    if (existingDeviceRes.rows.length > 0) {
      // Reactivate previously revoked device
      const existing = existingDeviceRes.rows[0];
      await client.query(
        `UPDATE devices 
         SET status = 'active',
             device_token_hash = $1,
             device_name = COALESCE($2, device_name),
             platform = COALESCE($3, platform),
             os_version = COALESCE($4, os_version),
             app_version = COALESCE($5, app_version),
             last_ip = COALESCE($6, last_ip),
             revoked_at = NULL,
             last_seen_at = NOW(),
             updated_at = NOW()
         WHERE id = $7;`,
        [tokenHash, deviceName, platform, osVersion, appVersion, ip, existing.id]
      );

      await client.query(
        `INSERT INTO device_audit_logs (user_id, device_id, action, ip_address, user_agent, metadata)
         VALUES ($1, $2, 'reactivated', $3, $4, $5);`,
        [
          userId,
          deviceId,
          ip,
          userAgent,
          JSON.stringify({ deviceName, platform, osVersion, appVersion }),
        ]
      );
    } else {
      // Insert brand new device
      await client.query(
        `INSERT INTO devices 
           (user_id, device_id, device_token_hash, device_name, platform, os_version, app_version, status, last_ip, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW());`,
        [userId, deviceId, tokenHash, deviceName, platform, osVersion, appVersion, ip]
      );

      await client.query(
        `INSERT INTO device_audit_logs (user_id, device_id, action, ip_address, user_agent, metadata)
         VALUES ($1, $2, 'registered', $3, $4, $5);`,
        [
          userId,
          deviceId,
          ip,
          userAgent,
          JSON.stringify({ deviceName, platform, osVersion, appVersion }),
        ]
      );
    }

    await client.query("COMMIT;");
    return {
      success: true,
      status: "active",
      message: "Device successfully registered and activated.",
      deviceId,
      maxDevices,
      activeCount: activeCount + 1,
    };
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verify device credentials and active status.
 */
export async function verifyDevice(
  userId: string,
  deviceId: string,
  deviceToken: string,
  ipAddress?: string
): Promise<VerifyDeviceResult> {
  if (!userId || !deviceId || !deviceToken) {
    return {
      valid: false,
      code: "INVALID_DEVICE_TOKEN",
      message: "Missing device identification or token.",
    };
  }

  const res = await pool.query(
    `SELECT d.id, d.user_id, d.device_id, d.device_token_hash, d.status, u.status AS user_status 
     FROM devices d
     JOIN users u ON u.id = d.user_id
     WHERE d.user_id = $1 AND d.device_id = $2;`,
    [userId, deviceId]
  );

  if (res.rows.length === 0) {
    return {
      valid: false,
      code: "DEVICE_NOT_REGISTERED",
      message: "Device is not registered for this account.",
    };
  }

  const device = res.rows[0];

  if (device.user_status !== "active") {
    return {
      valid: false,
      code: "USER_INACTIVE",
      message: "User account is suspended or inactive.",
    };
  }

  if (device.status !== "active") {
    return {
      valid: false,
      code: "DEVICE_REVOKED",
      message: "This device has been deactivated or revoked.",
    };
  }

  if (!verifyDeviceToken(device.device_token_hash, deviceToken)) {
    return {
      valid: false,
      code: "INVALID_DEVICE_TOKEN",
      message: "Invalid device credentials.",
    };
  }

  // Update last seen timestamp and IP (asynchronous update)
  pool.query(
    "UPDATE devices SET last_seen_at = NOW(), last_ip = COALESCE($1, last_ip) WHERE id = $2;",
    [ipAddress || null, device.id]
  ).catch((e) => console.error("Error updating device last_seen_at:", e));

  return { valid: true };
}

/**
 * List all devices for an authenticated user.
 * Excludes sensitive token hashes.
 */
export async function listUserDevices(userId: string) {
  const userRes = await pool.query(
    "SELECT max_devices FROM users WHERE id = $1;",
    [userId]
  );

  const maxDevices = userRes.rows[0]?.max_devices || 2;

  const devicesRes = await pool.query(
    `SELECT id, device_id AS "deviceId", device_name AS "deviceName", 
            platform, os_version AS "osVersion", app_version AS "appVersion", 
            status, last_seen_at AS "lastSeenAt", created_at AS "createdAt", 
            revoked_at AS "revokedAt", replacement_count AS "replacementCount"
     FROM devices 
     WHERE user_id = $1
     ORDER BY (status = 'active') DESC, last_seen_at DESC;`,
    [userId]
  );

  const devices = devicesRes.rows;
  const activeCount = devices.filter((d: any) => d.status === "active").length;

  return {
    devices,
    maxDevices,
    activeCount,
  };
}

/**
 * Revoke/deactivate an active device belonging to the user.
 */
export async function revokeDevice(
  userId: string,
  deviceId: string,
  reason: string = "User deactivated device",
  context?: { ipAddress?: string; userAgent?: string }
): Promise<{ success: boolean; message: string }> {
  const ip = context?.ipAddress || null;
  const userAgent = context?.userAgent || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    const updateRes = await client.query(
      `UPDATE devices 
       SET status = 'revoked',
           revoked_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1 AND device_id = $2 AND status = 'active'
       RETURNING id, device_id;`,
      [userId, deviceId]
    );

    if (updateRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      return {
        success: false,
        message: "Device not found or already deactivated.",
      };
    }

    await client.query(
      `INSERT INTO device_audit_logs (user_id, device_id, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'revoked', $3, $4, $5);`,
      [userId, deviceId, ip, userAgent, JSON.stringify({ reason })]
    );

    await client.query("COMMIT;");
    return {
      success: true,
      message: "Device deactivated successfully.",
    };
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Replace an existing active device with a new device atomically.
 * Enforces maximum 5 replacements per 30 days per user.
 */
export async function replaceDevice(
  userId: string,
  revokeDeviceId: string,
  newDeviceData: DeviceMetadata,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<{ success: boolean; message: string; deviceId: string }> {
  const ip = context?.ipAddress || null;
  const userAgent = context?.userAgent || null;
  const { deviceId: newDeviceId, deviceToken: newDeviceToken, deviceName = "Windows PC", platform = "win32", osVersion, appVersion } = newDeviceData;

  if (!newDeviceId || !newDeviceToken) {
    throw new Error("Invalid new device credentials.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 1. Lock user row
    const userRes = await client.query(
      "SELECT id, status, max_devices FROM users WHERE id = $1 FOR UPDATE;",
      [userId]
    );
    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      const err: any = new Error("User not found.");
      err.status = 404;
      throw err;
    }

    // 2. Check 30-day replacement rate limit (max 5 replacements)
    const replacementCountRes = await client.query(
      `SELECT COUNT(*)::int AS count 
       FROM device_audit_logs 
       WHERE user_id = $1 AND action = 'replaced' AND created_at > NOW() - INTERVAL '30 days';`,
      [userId]
    );

    const replacementsInWindow = replacementCountRes.rows[0]?.count || 0;
    if (replacementsInWindow >= 5) {
      await client.query("ROLLBACK;");
      const err: any = new Error("Maximum 5 device replacements allowed per 30-day period. Please contact support.");
      err.status = 429;
      err.code = "REPLACEMENT_LIMIT_EXCEEDED";
      throw err;
    }

    // 3. Deactivate old device
    const revokeRes = await client.query(
      `UPDATE devices 
       SET status = 'revoked',
           revoked_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1 AND device_id = $2 AND status = 'active'
       RETURNING id, replacement_count;`,
      [userId, revokeDeviceId]
    );

    if (revokeRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      const err: any = new Error("Target device to replace was not found or is already deactivated.");
      err.status = 400;
      err.code = "DEVICE_NOT_FOUND";
      throw err;
    }

    // 4. Activate or insert new device
    const newTokenHash = hashDeviceToken(newDeviceToken);
    const existingNewDevice = await client.query(
      "SELECT id, replacement_count FROM devices WHERE user_id = $1 AND device_id = $2 FOR UPDATE;",
      [userId, newDeviceId]
    );

    if (existingNewDevice.rows.length > 0) {
      const curRepCount = (existingNewDevice.rows[0].replacement_count || 0) + 1;
      await client.query(
        `UPDATE devices 
         SET status = 'active',
             device_token_hash = $1,
             device_name = COALESCE($2, device_name),
             platform = COALESCE($3, platform),
             os_version = COALESCE($4, os_version),
             app_version = COALESCE($5, app_version),
             last_ip = COALESCE($6, last_ip),
             replacement_count = $7,
             revoked_at = NULL,
             last_seen_at = NOW(),
             updated_at = NOW()
         WHERE id = $8;`,
        [newTokenHash, deviceName, platform, osVersion, appVersion, ip, curRepCount, existingNewDevice.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO devices 
           (user_id, device_id, device_token_hash, device_name, platform, os_version, app_version, status, last_ip, replacement_count, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, 1, NOW());`,
        [userId, newDeviceId, newTokenHash, deviceName, platform, osVersion, appVersion, ip]
      );
    }

    // 5. Audit logs for both devices
    await client.query(
      `INSERT INTO device_audit_logs (user_id, device_id, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'replaced', $3, $4, $5);`,
      [userId, revokeDeviceId, ip, userAgent, JSON.stringify({ replacedBy: newDeviceId })]
    );

    await client.query(
      `INSERT INTO device_audit_logs (user_id, device_id, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'registered', $3, $4, $5);`,
      [userId, newDeviceId, ip, userAgent, JSON.stringify({ replacedDeviceId: revokeDeviceId })]
    );

    await client.query("COMMIT;");
    return {
      success: true,
      message: "Device replaced successfully.",
      deviceId: newDeviceId,
    };
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}

