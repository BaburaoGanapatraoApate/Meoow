import { pool } from "./database";

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    console.error("Failed to connect to Meoow database: DATABASE_URL environment variable is not defined.");
    return false;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Failed to connect to Meoow database:", error?.message || error);
    return false;
  }
}

