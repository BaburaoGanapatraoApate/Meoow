import { pool } from "./database";
import dotenv from "dotenv";

dotenv.config();

async function bootstrapAdmin() {
  const targetEmail = process.argv[2] || process.env.ADMIN_BOOTSTRAP_EMAIL;

  if (!targetEmail || targetEmail.trim().length === 0) {
    console.error("Usage: npm run admin:bootstrap <email> OR set ADMIN_BOOTSTRAP_EMAIL in environment");
    process.exit(1);
  }

  const email = targetEmail.trim().toLowerCase();

  try {
    const userRes = await pool.query(
      "SELECT id, name, email, role, email_verified FROM users WHERE email = $1",
      [email]
    );

    if (userRes.rows.length === 0) {
      console.error(`User with email "${email}" does not exist in database.`);
      process.exit(1);
    }

    const user = userRes.rows[0];

    if (user.role === "admin") {
      console.log(`User "${email}" is already an admin.`);
      process.exit(0);
    }

    await pool.query(
      "UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1",
      [user.id]
    );

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, target_user_id, action, metadata)
       VALUES ($1, $1, 'bootstrap_admin', $2)`,
      [user.id, JSON.stringify({ email, reason: "CLI Admin Bootstrap" })]
    );

    console.log(`Successfully elevated user "${email}" (ID: ${user.id}) to role: admin.`);
    process.exit(0);
  } catch (err: any) {
    console.error("Failed to bootstrap admin:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

bootstrapAdmin();

