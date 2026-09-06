import { Router, Response } from "express";
import { z } from "zod";
import { pool } from "../db/database";
import { authMiddleware } from "../middleware/auth";
import { requireAdmin, AdminRequest } from "../middleware/adminAuth";
import {
  getUserProviderStatus,
  assignProviderOverrides,
  removeProviderOverrides,
  setUserUsageMode,
  ProviderCredentialError,
} from "../services/providerCredentialService";

const router = Router();

// Enforce authentication and admin privileges across all admin routes
router.use(authMiddleware);
router.use(requireAdmin);

// Zod Schemas
const uuidSchema = z.string().uuid("Invalid user ID format.");

const assignOverridesSchema = z.object({
  groqApiKey: z.string().min(10, "Groq API key must be at least 10 characters").max(500).optional(),
  deepgramApiKey: z.string().min(10, "Deepgram API key must be at least 10 characters").max(500).optional(),
}).refine(data => data.groqApiKey || data.deepgramApiKey, {
  message: "At least one provider API key (groqApiKey or deepgramApiKey) must be provided.",
});

const assignSingleOverrideSchema = z.object({
  provider: z.enum(["groq", "deepgram"]),
  apiKey: z.string().min(10, "API key must be at least 10 characters").max(500),
});

const updateUsageModeSchema = z.object({
  usageMode: z.enum(["credits", "unlimited"]),
});

const usersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(100).optional(),
});

function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(", ");
}

/**
 * 1. GET /api/admin/stats
 * Overview dashboard metrics.
 */
router.get("/stats", async (_req: AdminRequest, res: Response) => {
  try {
    const totalUsersRes = await pool.query("SELECT count(*) FROM users");
    const verifiedUsersRes = await pool.query("SELECT count(*) FROM users WHERE email_verified = TRUE");
    const creditUsersRes = await pool.query("SELECT count(*) FROM users WHERE credits > 0");
    const unlimitedUsersRes = await pool.query("SELECT count(*) FROM users WHERE usage_mode = 'unlimited'");
    const overrideUsersRes = await pool.query(
      "SELECT count(DISTINCT user_id) FROM provider_credentials"
    );

    res.status(200).json({
      totalUsers: parseInt(totalUsersRes.rows[0].count, 10),
      verifiedUsers: parseInt(verifiedUsersRes.rows[0].count, 10),
      usersWithCredits: parseInt(creditUsersRes.rows[0].count, 10),
      unlimitedUsers: parseInt(unlimitedUsersRes.rows[0].count, 10),
      usersWithOverrides: parseInt(overrideUsersRes.rows[0].count, 10),
    });
  } catch (err: any) {
    res.status(500).json({
      error: "FETCH_STATS_FAILED",
      message: "Failed to load admin dashboard statistics.",
    });
  }
});

/**
 * 2. GET /api/admin/users
 * Searchable, paginated user list with provider override status (zero secrets).
 */
router.get("/users", async (req: AdminRequest, res: Response) => {
  const parseResult = usersQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      error: "INVALID_QUERY",
      message: formatZodErrors(parseResult.error),
    });
    return;
  }

  const { limit, offset, search } = parseResult.data;

  try {
    let query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.email_verified AS "emailVerified", 
        u.credits, 
        u.usage_mode AS "usageMode", 
        u.role, 
        u.status, 
        u.created_at AS "createdAt",
        u.last_login_at AS "lastLoginAt",
        COALESCE(BOOL_OR(pc.provider = 'groq'), FALSE) AS "hasGroqOverride",
        COALESCE(BOOL_OR(pc.provider = 'deepgram'), FALSE) AS "hasDeepgramOverride"
      FROM users u
      LEFT JOIN provider_credentials pc ON u.id = pc.user_id
    `;

    const values: any[] = [];
    if (search && search.trim().length > 0) {
      values.push(`%${search.trim().toLowerCase()}%`);
      query += ` WHERE LOWER(u.email) LIKE $1 OR LOWER(u.name) LIKE $1 `;
    }

    query += `
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    values.push(limit, offset);

    const usersRes = await pool.query(query, values);

    // Total count for pagination
    let countQuery = "SELECT count(*) FROM users";
    let countValues: any[] = [];
    if (search && search.trim().length > 0) {
      countQuery += " WHERE LOWER(email) LIKE $1 OR LOWER(name) LIKE $1";
      countValues.push(`%${search.trim().toLowerCase()}%`);
    }
    const countRes = await pool.query(countQuery, countValues);

    res.status(200).json({
      users: usersRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      limit,
      offset,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "FETCH_USERS_FAILED",
      message: "Failed to retrieve users list.",
    });
  }
});

/**
 * 3. GET /api/admin/users/:userId
 * Single user details and provider override status.
 */
router.get("/users/:userId", async (req: AdminRequest, res: Response) => {
  const userId = req.params.userId as string;
  const parseId = uuidSchema.safeParse(userId);
  if (!parseId.success) {
    res.status(400).json({ error: "INVALID_USER_ID", message: "Invalid UUID format." });
    return;
  }

  try {
    const status = await getUserProviderStatus(userId);
    const userRes = await pool.query(
      "SELECT id, name, email, email_verified, credits, usage_mode, role, status, created_at, last_login_at FROM users WHERE id = $1",
      [userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "USER_NOT_FOUND", message: "User does not exist." });
      return;
    }

    const u = userRes.rows[0];
    res.status(200).json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.email_verified,
        credits: u.credits,
        usageMode: u.usage_mode,
        role: u.role,
        status: u.status,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      },
      providerStatus: status,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: err.code || "FETCH_USER_FAILED",
      message: err.message || "Failed to retrieve user details.",
    });
  }
});

/**
 * 4. POST /api/admin/users/:userId/provider-overrides
 * Atomic assignment of both Groq and Deepgram overrides (enables unlimited friend mode).
 */
router.post("/users/:userId/provider-overrides", async (req: AdminRequest, res: Response) => {
  const userId = req.params.userId as string;
  const parseId = uuidSchema.safeParse(userId);
  if (!parseId.success) {
    res.status(400).json({ error: "INVALID_USER_ID", message: "Invalid UUID format." });
    return;
  }

  const parsed = assignOverridesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: formatZodErrors(parsed.error),
    });
    return;
  }

  try {
    const result = await assignProviderOverrides(req.adminUser!.id, userId, parsed.data);
    res.status(200).json({
      success: true,
      message: "Provider overrides successfully assigned.",
      providerStatus: result,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: err.code || "ASSIGN_OVERRIDES_FAILED",
      message: err.message || "Failed to assign provider overrides.",
    });
  }
});

/**
 * 5. POST /api/admin/users/:userId/provider-override
 * Single provider override assignment.
 */
router.post("/users/:userId/provider-override", async (req: AdminRequest, res: Response) => {
  const userId = req.params.userId as string;
  const parseId = uuidSchema.safeParse(userId);
  if (!parseId.success) {
    res.status(400).json({ error: "INVALID_USER_ID", message: "Invalid UUID format." });
    return;
  }

  const parsed = assignSingleOverrideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: formatZodErrors(parsed.error),
    });
    return;
  }

  try {
    const payload = parsed.data.provider === "groq"
      ? { groqApiKey: parsed.data.apiKey }
      : { deepgramApiKey: parsed.data.apiKey };

    const result = await assignProviderOverrides(req.adminUser!.id, userId, payload);
    res.status(200).json({
      success: true,
      message: `${parsed.data.provider} override successfully assigned.`,
      providerStatus: result,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: err.code || "ASSIGN_OVERRIDE_FAILED",
      message: err.message || "Failed to assign provider override.",
    });
  }
});

/**
 * 6. DELETE /api/admin/users/:userId/provider-overrides
 * Atomic removal of all provider overrides (resets usageMode to 'credits').
 */
router.delete("/users/:userId/provider-overrides", async (req: AdminRequest, res: Response) => {
  const userId = req.params.userId as string;
  const parseId = uuidSchema.safeParse(userId);
  if (!parseId.success) {
    res.status(400).json({ error: "INVALID_USER_ID", message: "Invalid UUID format." });
    return;
  }

  try {
    const result = await removeProviderOverrides(req.adminUser!.id, userId);
    res.status(200).json({
      success: true,
      message: "All provider overrides removed. User reset to standard credits mode.",
      providerStatus: result,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: err.code || "REMOVE_OVERRIDES_FAILED",
      message: err.message || "Failed to remove provider overrides.",
    });
  }
});

/**
 * 7. DELETE /api/admin/users/:userId/provider-override/:provider
 * Removal of a specific provider override.
 */
router.delete("/users/:userId/provider-override/:provider", async (req: AdminRequest, res: Response) => {
  const userId = req.params.userId as string;
  const provider = req.params.provider as string;
  const parseId = uuidSchema.safeParse(userId);
  if (!parseId.success) {
    res.status(400).json({ error: "INVALID_USER_ID", message: "Invalid UUID format." });
    return;
  }

  if (provider !== "groq" && provider !== "deepgram") {
    res.status(400).json({
      error: "INVALID_PROVIDER",
      message: "Provider must be 'groq' or 'deepgram'.",
    });
    return;
  }

  try {
    const result = await removeProviderOverrides(req.adminUser!.id, userId, provider as any);
    res.status(200).json({
      success: true,
      message: `${provider} override removed.`,
      providerStatus: result,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: err.code || "REMOVE_OVERRIDE_FAILED",
      message: err.message || "Failed to remove provider override.",
    });
  }
});

/**
 * 8. PATCH /api/admin/users/:userId/usage-mode
 * Manually update user usage mode ('credits' | 'unlimited').
 */
router.patch("/users/:userId/usage-mode", async (req: AdminRequest, res: Response) => {
  const userId = req.params.userId as string;
  const parseId = uuidSchema.safeParse(userId);
  if (!parseId.success) {
    res.status(400).json({ error: "INVALID_USER_ID", message: "Invalid UUID format." });
    return;
  }

  const parsed = updateUsageModeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST_PAYLOAD",
      message: formatZodErrors(parsed.error),
    });
    return;
  }

  try {
    const result = await setUserUsageMode(req.adminUser!.id, userId, parsed.data.usageMode);
    res.status(200).json({
      success: true,
      message: `Usage mode updated to '${parsed.data.usageMode}'.`,
      ...result,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: err.code || "UPDATE_USAGE_MODE_FAILED",
      message: err.message || "Failed to update user usage mode.",
    });
  }
});

/**
 * 9. GET /api/admin/audit-logs
 * View recent admin audit logs.
 */
router.get("/audit-logs", async (req: AdminRequest, res: Response) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

  try {
    const logsRes = await pool.query(
      `SELECT 
        l.id, 
        l.action, 
        l.provider, 
        l.metadata, 
        l.created_at AS "createdAt",
        admin_u.email AS "adminEmail",
        target_u.email AS "targetEmail"
       FROM admin_audit_logs l
       LEFT JOIN users admin_u ON l.admin_user_id = admin_u.id
       LEFT JOIN users target_u ON l.target_user_id = target_u.id
       ORDER BY l.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.status(200).json({ logs: logsRes.rows });
  } catch (err: any) {
    res.status(500).json({
      error: "FETCH_AUDIT_LOGS_FAILED",
      message: "Failed to retrieve admin audit logs.",
    });
  }
});

export default router;
