import { checkDatabaseConnection } from "./checkDatabase";
import { pool } from "./database";

async function runTest() {
  console.log("Testing PostgreSQL database connectivity (SELECT 1)...");
  const success = await checkDatabaseConnection();
  if (success) {
    console.log("Database connectivity test PASSED: successfully executed SELECT 1");
    await pool.end();
    process.exit(0);
  } else {
    console.error("Database connectivity test FAILED");
    await pool.end();
    process.exit(1);
  }
}

runTest();

