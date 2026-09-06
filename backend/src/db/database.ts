import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: databaseUrl && (databaseUrl.includes("sslmode=require") || databaseUrl.includes("neon.tech"))
    ? { rejectUnauthorized: false }
    : undefined
});

pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle PostgreSQL client:", err.message || err);
});

