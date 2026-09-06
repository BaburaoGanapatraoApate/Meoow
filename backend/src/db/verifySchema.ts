import { pool } from "./database";

async function verifySchema() {
  const client = await pool.connect();
  try {
    console.log("=== 1. TABLES IN PUBLIC SCHEMA ===");
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(tables.map((t) => t.table_name));

    console.log("\n=== 2. PRIMARY KEYS ===");
    const { rows: pks } = await client.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name 
      FROM information_schema.table_constraints tc 
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `);
    console.log(pks);

    console.log("\n=== 3. FOREIGN KEYS ===");
    const { rows: fks } = await client.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu 
        ON tc.constraint_name = kcu.constraint_name 
      JOIN information_schema.referential_constraints AS rc 
        ON tc.constraint_name = rc.constraint_name 
      JOIN information_schema.constraint_column_usage AS ccu 
        ON ccu.constraint_name = tc.constraint_name 
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name;
    `);
    console.log(fks);

    console.log("\n=== 4. INDEXES ===");
    const { rows: indexes } = await client.query(`
      SELECT 
        tablename, 
        indexname, 
        indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    console.log(indexes);

    console.log("\n=== 5. ROW COUNTS ===");
    const expectedTables = [
      "users",
      "otp_codes",
      "credit_transactions",
      "interview_sessions",
      "devices",
      "schema_migrations"
    ];
    for (const tbl of expectedTables) {
      const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${tbl};`);
      console.log(`${tbl}: ${rows[0].count} records`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

verifySchema().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

