import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { pool } from "./database";

dotenv.config();

export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("Migration failed: DATABASE_URL environment variable is not defined.");
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // 1. Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Query already applied migrations
    const { rows: appliedRows } = await client.query<{ migration_name: string }>(
      "SELECT migration_name FROM schema_migrations ORDER BY id ASC;"
    );
    const appliedMigrations = new Set(appliedRows.map((r) => r.migration_name));

    // 3. Find migration files in migrations directory
    let migrationsDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(process.cwd(), "src", "db", "migrations");
    }
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, "../../src/db/migrations");
    }
    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations directory not found. Checked: ${migrationsDir}`);
      process.exit(1);
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const pendingMigrations = migrationFiles.filter((file) => !appliedMigrations.has(file));

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations to apply. Database is up to date.");
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s)...`);

    // 4. Run each pending migration within a transaction
    for (const file of pendingMigrations) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`Applying migration: ${file}...`);
      await client.query("BEGIN;");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (migration_name) VALUES ($1);", [file]);
        await client.query("COMMIT;");
        console.log(`Successfully applied migration: ${file}`);
      } catch (err: any) {
        await client.query("ROLLBACK;");
        console.error(`Error applying migration ${file}:`, err?.message || err);
        throw err;
      }
    }

    console.log("All migrations applied successfully.");
  } finally {
    client.release();
  }
}

// If executed directly from CLI
if (require.main === module) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Migration runner failed:", err?.message || err);
      await pool.end();
      process.exit(1);
    });
}

