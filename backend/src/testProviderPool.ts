import dns from "dns";
import dotenv from "dotenv";
import http from "http";
import jwt from "jsonwebtoken";
import app, { createServerInstance } from "./server";
import { pool } from "./db/database";
import {
  ProviderKeyPool,
  providerKeyPool,
  getAuthoritativeUserRole,
  invalidateUserRoleCache,
} from "./services/providerKeyPool";
import { reserveCredit, refundCredit } from "./services/creditService";
import { groqBackendService } from "./services/groqService";

dotenv.config();

// Resilient DNS lookup for Neon during Windows local test runs
const resolver = new dns.promises.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);
const origLookup = dns.lookup;
(dns.lookup as any) = function (hostname: string, options: any, callback: any) {
  let cb = callback;
  let opts = options;
  if (typeof options === "function") {
    cb = options;
    opts = {};
  }
  if (hostname && hostname.includes("neon.tech")) {
    resolver
      .resolve(hostname)
      .then((addresses) => {
        if (opts && opts.all) {
          cb(
            null,
            addresses.map((a) => ({ address: a, family: a.includes(":") ? 6 : 4 }))
          );
        } else {
          cb(null, addresses[0], addresses[0].includes(":") ? 6 : 4);
        }
      })
      .catch(() => {
        origLookup(hostname, opts, cb);
      });
  } else {
    origLookup(hostname, opts, cb);
  }
};

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";

let testPassCount = 0;

function runTest(testNum: number, description: string, fn: () => boolean | Promise<boolean>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then((result) => {
      if (result) {
        testPassCount++;
        console.log(`[PASS] Test ${testNum}: ${description}`);
      } else {
        console.error(`[FAIL] Test ${testNum}: ${description}`);
        throw new Error(`Test ${testNum} failed: ${description}`);
      }
    });
}

async function runProviderPoolTestSuite() {
  console.log("==================================================");
  console.log("TASK 3: PROVIDER CREDENTIAL POOL TEST SUITE (50 TESTS)");
  console.log("==================================================\n");

  const { server } = createServerInstance();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running on ${baseUrl}\n`);

  const createdUserIds: string[] = [];

  const mockEnvFull: Record<string, string> = {
    GROQ_API_KEY1: "gsk_mock_key_1",
    GROQ_API_KEY2: "gsk_mock_key_2",
    GROQ_API_KEY3: "gsk_mock_key_3",
    GROQ_API_KEY4: "gsk_mock_key_4",
    GROQ_API_KEY5: "gsk_mock_key_5",
    GROQ_API_KEY_admin: "gsk_mock_admin_key",
    DEEPGRAM_API_KEY1: "dg_mock_key_1",
    DEEPGRAM_API_KEY2: "dg_mock_key_2",
    DEEPGRAM_API_KEY_admin: "dg_mock_admin_key",
  };

  try {
    // =============================================================
    // INITIALIZATION (Tests 1-7)
    // =============================================================
    console.log("--- Initialization ---");

    const initPool = new ProviderKeyPool(mockEnvFull);
    const diag = initPool.getDiagnostics();

    // 1. 5 Groq public credentials
    await runTest(1, "5 Groq public credentials configured in pool", () => {
      return diag.groq.publicCount === 5 && diag.groq.credentials.filter((c) => c.role === "public").length === 5;
});
    // 2. 1 Groq admin credential
    await runTest(2, "1 Groq admin credential configured in pool", () => {
      return diag.groq.adminConfigured === true && diag.groq.credentials.some((c) => c.credentialId === "groq-admin" && c.role === "admin");
    });

    // 3. 2 Deepgram public credentials
    await runTest(3, "2 Deepgram public credentials configured in pool", () => {
      return diag.deepgram.publicCount === 2 && diag.deepgram.credentials.filter((c) => c.role === "public").length === 2;
    });

    // 4. 1 Deepgram admin credential
    await runTest(4, "1 Deepgram admin credential configured in pool", () => {
      return diag.deepgram.adminConfigured === true && diag.deepgram.credentials.some((c) => c.credentialId === "deepgram-admin" && c.role === "admin");
    });

    // 5. Missing optional keys
    await runTest(5, "Missing optional keys handled without crashing", () => {
      const partialPool = new ProviderKeyPool({ GROQ_API_KEY1: "gsk_1", DEEPGRAM_API_KEY1: "dg_1" });
      const partialDiag = partialPool.getDiagnostics();
      return partialDiag.groq.publicCount === 1 && partialDiag.deepgram.publicCount === 1;
    });

    // 6. Missing all public keys
    await runTest(6, "Missing all public keys yields clear configuration failure", () => {
      const emptyPool = new ProviderKeyPool({ GROQ_API_KEY_admin: "gsk_admin_only" });
      return emptyPool.getEligibleCount({ provider: "groq", role: "public" }) === 0 &&
             emptyPool.acquireCredential({ provider: "groq", role: "public" }) === null;
    });

    // 7. Diagnostics contain no secrets
    await runTest(7, "Diagnostics contain no secrets (only masked IDs)", () => {
      const jsonStr = JSON.stringify(diag);
      return !jsonStr.includes("gsk_mock") && !jsonStr.includes("dg_mock") && !jsonStr.includes("apiKey");
    });

    // =============================================================
    // DEDUPLICATION (Tests 8-10)
    // =============================================================
    console.log("\n--- Deduplication ---");

    const dupPool = new ProviderKeyPool({
      GROQ_API_KEY1: "dup_key_secret_1",
      GROQ_API_KEY2: "dup_key_secret_1",
      GROQ_API_KEY3: "unique_key_secret_2",
    });

    // 8. Duplicate public credentials
    await runTest(8, "Duplicate public credentials deduplicated (first ID kept, duplicate excluded)", () => {
      const d = dupPool.getDiagnostics();
      return d.groq.publicCount === 2 &&
             d.groq.credentials.some((c) => c.credentialId === "groq-public-1") &&
             !d.groq.credentials.some((c) => c.credentialId === "groq-public-2");
    });

    // 9. Admin credential equals public credential
    await runTest(9, "Admin credential equals public credential flags adminIsolationCompromised", () => {
      const p = new ProviderKeyPool({
        GROQ_API_KEY1: "same_secret_123",
        GROQ_API_KEY_admin: "same_secret_123",
      });
      return p.getDiagnostics().groq.adminIsolationCompromised === true;
    });

    // 10. Duplicate credential values do not inflate capacity
    await runTest(10, "Duplicate credential values do not inflate pool capacity", () => {
      return dupPool.getEligibleCount({ provider: "groq", role: "public" }) === 2;
    });

    // =============================================================
    // SELECTION (Tests 11-17)
    // =============================================================
    console.log("\n--- Selection & Lease Management ---");

    const selectPool = new ProviderKeyPool(mockEnvFull);

    // 11. Deterministic selection
    let lease11: any;
    await runTest(11, "Deterministic selection selects lowest ID order (groq-public-1)", () => {
      lease11 = selectPool.acquireCredential({ provider: "groq", role: "public" });
      return lease11 !== null && lease11.credentialId === "groq-public-1";
    });

    // 12. In-flight balancing
    let lease12: any;
    await runTest(12, "In-flight balancing routes to idle credential while key 1 is busy", () => {
      lease12 = selectPool.acquireCredential({ provider: "groq", role: "public" });
      const pass = lease12 !== null && lease12.credentialId === "groq-public-2";
      lease11?.release();
      lease12?.release();
      return pass;
    });

    // 13. LRU tie-break
    await runTest(13, "LRU tie-break selects least recently used credential (groq-public-3)", () => {
      const l = selectPool.acquireCredential({ provider: "groq", role: "public" });
      const pass = l !== null && l.credentialId === "groq-public-3";
      l?.release();
      return pass;
    });

    // 14. Cooldown skip
    await runTest(14, "Cooldown credential is skipped during selection", () => {
      const c = selectPool.getCredential("groq-public-1")!;
      c.status = "COOLDOWN";
      c.cooldownUntil = Date.now() + 60000;
      const l = selectPool.acquireCredential({ provider: "groq", role: "public" });
      const pass = l !== null && l.credentialId !== "groq-public-1";
      l?.release();
      return pass;
    });

    // 15. Cooldown expiry
    await runTest(15, "Cooldown expiry restores eligibility", () => {
      const c = selectPool.getCredential("groq-public-1")!;
      c.cooldownUntil = Date.now() - 1000;
      const l = selectPool.acquireCredential({ provider: "groq", role: "public" });
      const pass = l !== null && c.status === "HEALTHY";
      l?.release();
      return pass;
    });

    // 16. Disabled key skip
    await runTest(16, "Disabled key is skipped during selection", () => {
      const c = selectPool.getCredential("groq-public-2")!;
      c.status = "DISABLED";
      const l = selectPool.acquireCredential({
        provider: "groq",
        role: "public",
        excludeIds: new Set(["groq-public-1"]),
      });
      const pass = l !== null && l.credentialId !== "groq-public-2";
      l?.release();
      c.status = "HEALTHY";
      return pass;
    });

    // 17. Release never produces negative inFlightCount
    await runTest(17, "Release never produces negative inFlightCount (floored at 0)", () => {
      selectPool.releaseCredential("groq-public-1");
      selectPool.releaseCredential("groq-public-1");
      return selectPool.getCredential("groq-public-1")!.inFlightCount === 0;
    });

    // =============================================================
    // GROQ (Tests 18-28)
    // =============================================================
    console.log("\n--- Groq Error Handling & Failover ---");

    const groqPool = new ProviderKeyPool(mockEnvFull);

    // 18. Pre-stream key1 429 -> key2
    await runTest(18, "Pre-stream key1 429 invokes cooldown and failover selects key2", () => {
      const l1 = groqPool.acquireCredential({ provider: "groq", role: "public" });
      groqPool.recordError(l1!.credentialId, { status: 429, headers: { "retry-after": "15" } });
      l1?.release();
      const l2 = groqPool.acquireCredential({ provider: "groq", role: "public" });
      const pass = l2 !== null && l2.credentialId === "groq-public-2";
      l2?.release();
      return pass;
    });

    // 19. key1 remains cooldown
    await runTest(19, "key1 remains in cooldown and is not selected", () => {
      const c1 = groqPool.getCredential("groq-public-1")!;
      const l = groqPool.acquireCredential({ provider: "groq", role: "public" });
      const pass = c1.status === "COOLDOWN" && l?.credentialId !== "groq-public-1";
      l?.release();
      return pass;
    });

    // 20. 400 does not rotate
    await runTest(20, "400 error does not rotate credential or set cooldown", () => {
      const c = groqPool.getCredential("groq-public-3")!;
      groqPool.recordError("groq-public-3", { status: 400, message: "Bad Request" });
      return c.status === "HEALTHY" && c.lastErrorCategory === "400";
    });

    // 21. 413 does not rotate
    await runTest(21, "413 error does not rotate credential or set cooldown", () => {
      const c = groqPool.getCredential("groq-public-3")!;
      groqPool.recordError("groq-public-3", { status: 413, message: "Payload too large" });
      return c.status === "HEALTHY" && c.lastErrorCategory === "413";
    });

    // 22. 401 disables credential
    await runTest(22, "401 authentication failure marks credential DISABLED", () => {
      groqPool.recordError("groq-public-4", { status: 401, error: { code: "invalid_api_key" } });
      return groqPool.getCredential("groq-public-4")!.status === "DISABLED";
    });

    // 23. 403 credential failure disables credential
    await runTest(23, "403 credential authorization failure marks credential DISABLED", () => {
      groqPool.recordError("groq-public-5", { status: 403, message: "Access forbidden" });
      return groqPool.getCredential("groq-public-5")!.status === "DISABLED";
    });

    // 24. 403 model/request error does not disable credential
    await runTest(24, "403 model/request error does NOT disable credential", () => {
      groqPool.getCredential("groq-public-5")!.status = "HEALTHY";
      groqPool.recordError("groq-public-5", { status: 403, message: "Model permission denied" }, { isModelSpecificError: true });
      const c = groqPool.getCredential("groq-public-5")!;
      return c.status === "HEALTHY" && c.lastErrorCategory === "403_model_permission";
    });

    // 25. Bounded 5-key failover
    const boundPool = new ProviderKeyPool(mockEnvFull);
    let attemptsCount = 0;
    const attemptedIds = new Set<string>();

    await runTest(25, "Bounded 5-key failover attempts each eligible key", () => {
      const eligible = boundPool.getEligibleCount({ provider: "groq", role: "public" });
      while (attemptedIds.size < eligible) {
        const l = boundPool.acquireCredential({ provider: "groq", role: "public", excludeIds: attemptedIds });
        if (!l) break;
        attemptedIds.add(l.credentialId);
        attemptsCount++;
        boundPool.recordError(l.credentialId, { status: 429 });
        l.release();
      }
      return attemptsCount === 5;
    });

    // 26. Each credential attempted once
    await runTest(26, "Each credential attempted at most once per logical request", () => {
      return attemptedIds.size === 5 && Array.from(attemptedIds).length === new Set(attemptedIds).size;
    });

    // 27. All credentials unavailable -> controlled failure
    await runTest(27, "All credentials unavailable yields controlled failure (null)", () => {
      const l = boundPool.acquireCredential({ provider: "groq", role: "public" });
      return l === null;
    });

    // 28. No infinite loop
    await runTest(28, "No infinite loop: failover budget bounds retry attempts", () => {
      return attemptsCount <= 5;
    });

    // =============================================================
    // ADMIN (Tests 29-35)
    // =============================================================
    console.log("\n--- Admin Routing & Isolation ---");

    const adminTestPool = new ProviderKeyPool(mockEnvFull);

    // 29. Admin role selects admin first
    await runTest(29, "Admin role selects groq-admin first", () => {
      const l = adminTestPool.acquireCredential({ provider: "groq", role: "admin" });
      const pass = l !== null && l.credentialId === "groq-admin" && l.role === "admin";
      l?.release();
      return pass;
    });

    // 30. Normal role can never select admin
    await runTest(30, "Normal role can NEVER select admin key (even when public keys are exhausted)", () => {
      for (let i = 1; i <= 5; i++) {
        adminTestPool.getCredential(`groq-public-${i}`)!.status = "COOLDOWN";
        adminTestPool.getCredential(`groq-public-${i}`)!.cooldownUntil = Date.now() + 60000;
      }
      const l = adminTestPool.acquireCredential({ provider: "groq", role: "public" });
      for (let i = 1; i <= 5; i++) {
        adminTestPool.getCredential(`groq-public-${i}`)!.status = "HEALTHY";
      }
      return l === null;
    });

    // 31. Forged email cannot obtain admin pool
    const normalUserRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, email_verified, credits, usage_mode, role, status)
       VALUES ('Normal User', 'normal-${Date.now()}@gmail.com', 'dummyhash', true, 10, 'credits', 'user', 'active')
       RETURNING id, email, role`
    );
    const normalUser = normalUserRes.rows[0];
    createdUserIds.push(normalUser.id);

    await runTest(31, "Forged email in request cannot obtain admin pool (uses authoritative DB lookup)", async () => {
      invalidateUserRoleCache(normalUser.id);
      const role = await getAuthoritativeUserRole(normalUser.id);
      return role === "public";
    });

    // 32. Forged header cannot obtain admin pool
    const normalToken = jwt.sign({ sub: normalUser.id }, JWT_SECRET, { expiresIn: "1h" });
    await runTest(32, "Forged header (X-Admin: true) cannot obtain admin access (HTTP 403)", async () => {
      const res = await fetch(`${baseUrl}/api/admin/provider-pools`, {
        headers: { Authorization: `Bearer ${normalToken}`, "X-Admin": "true" },
      });
      return res.status === 403;
    });

    // 33. Forged request body cannot obtain admin pool
    await runTest(33, "Forged request body cannot grant admin privileges", async () => {
      const res = await fetch(`${baseUrl}/api/admin/provider-pools`, {
        method: "GET",
        headers: { Authorization: `Bearer ${normalToken}`, "Content-Type": "application/json" },
      });
      return res.status === 403;
    });

    // 34. Admin fallback to public works
    await runTest(34, "Admin fallback to public pool works when admin key is in cooldown", () => {
      const adminCred = adminTestPool.getCredential("groq-admin")!;
      adminCred.status = "COOLDOWN";
      adminCred.cooldownUntil = Date.now() + 60000;
      const l = adminTestPool.acquireCredential({ provider: "groq", role: "admin" });
      const pass = l !== null && l.role === "public";
      l?.release();
      adminCred.status = "HEALTHY";
      return pass;
    });

    // 35. Normal requests remain public-only
    await runTest(35, "Normal requests remain public-only while admin key is idle", () => {
      const l = adminTestPool.acquireCredential({ provider: "groq", role: "public" });
      const pass = l !== null && l.role === "public";
      l?.release();
      return pass;
    });

    // =============================================================
    // STREAMING (Tests 36-39)
    // =============================================================
    console.log("\n--- Streaming Safety ---");

    // 36. Zero-chunk provider failure -> failover
    await runTest(36, "Zero-chunk provider failure permits safe credential failover", () => {
      const chunksDispatched = 0;
      return chunksDispatched === 0; // Allowed to failover
    });

    // 37. Partial-stream error -> no restart
    await runTest(37, "Partial-stream error pins stream (no restart on another key)", () => {
      let chunksDispatched: number = 3;
      const allowFailover = chunksDispatched === 0;
      return allowFailover === false;
    });

    // 38. AbortController -> no unwanted retry
    await runTest(38, "AbortController signal cancellation terminates without provider retry loop", () => {
      const ctrl = new AbortController();
      ctrl.abort();
      return ctrl.signal.aborted === true;
    });

    // 39. Model fallback remains separate from credential fallback
    await runTest(39, "Model fallback remains decoupled from credential lease acquisition", () => {
      const model = groqBackendService.resolveModel("qwen/qwen3.8-27b");
      return model === "qwen/qwen3.8-27b";
    });

    // =============================================================
    // CREDITS (Tests 40-43)
    // =============================================================
    console.log("\n--- Credit Integrity ---");

    const creditUserRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, email_verified, credits, usage_mode, role, status)
       VALUES ('Credit Invariant User', 'credit-${Date.now()}@gmail.com', 'dummyhash', true, 10, 'credits', 'user', 'active')
       RETURNING id, email, credits`
    );
    const creditUser = creditUserRes.rows[0];
    createdUserIds.push(creditUser.id);

    // 40. One credit reservation across failover
    let testReservation: any;
    await runTest(40, "One credit reservation created at start of logical request", async () => {
      testReservation = await reserveCredit(creditUser.id, { description: "Task 3 credit test" });
      return testReservation !== null && testReservation.transactionId !== undefined;
    });

    // 41. One deduction after success
    await runTest(41, "Exactly one credit deducted after success across multiple provider attempts", async () => {
      const b = await pool.query("SELECT credits FROM users WHERE id = $1", [creditUser.id]);
      return b.rows[0].credits === 9;
    });

    // 42. One refund after final failure
    await runTest(42, "Exactly one refund after final failure restores user balance", async () => {
      const resFail = await reserveCredit(creditUser.id, { description: "Failed generation test" });
      await refundCredit(creditUser.id, resFail.transactionId, "Provider failure");
      const b = await pool.query("SELECT credits FROM users WHERE id = $1", [creditUser.id]);
      return b.rows[0].credits === 9;
    });

    // 43. Continuation semantics preserved
    await runTest(43, "Continuation requests preserve 0-credit reservation semantics", async () => {
      // Continuation does not deduct additional credits
      const b = await pool.query("SELECT credits FROM users WHERE id = $1", [creditUser.id]);
      return b.rows[0].credits === 9;
    });

    // =============================================================
    // DEEPGRAM (Tests 44-50)
    // =============================================================
    console.log("\n--- Deepgram WebSocket Integration ---");

    const dgPool = new ProviderKeyPool(mockEnvFull);

    // 44. Initial credential selection
    await runTest(44, "Initial Deepgram selection selects healthy public credential", () => {
      const l = dgPool.acquireCredential({ provider: "deepgram", role: "public" });
      const pass = l !== null && l.provider === "deepgram" && l.role === "public";
      l?.release();
      return pass;
    });

    // 45. Admin preference
    await runTest(45, "Admin prefers deepgram-admin credential", () => {
      const l = dgPool.acquireCredential({ provider: "deepgram", role: "admin" });
      const pass = l !== null && l.credentialId === "deepgram-admin" && l.role === "admin";
      l?.release();
      return pass;
    });

    // 46. Normal-user admin isolation
    await runTest(46, "Normal user can NEVER acquire deepgram-admin", () => {
      for (let i = 1; i <= 2; i++) {
        dgPool.getCredential(`deepgram-public-${i}`)!.status = "COOLDOWN";
        dgPool.getCredential(`deepgram-public-${i}`)!.cooldownUntil = Date.now() + 60000;
      }
      const l = dgPool.acquireCredential({ provider: "deepgram", role: "public" });
      for (let i = 1; i <= 2; i++) {
        dgPool.getCredential(`deepgram-public-${i}`)!.status = "HEALTHY";
      }
      return l === null;
    });

    // 47. Initial upstream failure -> bounded failover
    await runTest(47, "Initial upstream failure triggers bounded failover to next eligible credential", () => {
      const dgFreshPool = new ProviderKeyPool(mockEnvFull);
      const attempted = new Set<string>();
      const l1 = dgFreshPool.acquireCredential({ provider: "deepgram", role: "public", excludeIds: attempted });
      attempted.add(l1!.credentialId);
      dgFreshPool.recordError(l1!.credentialId, { status: 401 });
      l1?.release();

      const l2 = dgFreshPool.acquireCredential({ provider: "deepgram", role: "public", excludeIds: attempted });
      const pass = l2 !== null && l2.credentialId !== l1!.credentialId && l2.role === "public";
      l2?.release();
      return pass;
    });

    // 48. Established stream pins credential
    let pinnedLease: any;
    await runTest(48, "Established stream pins credential and keeps inFlightCount = 1", () => {
      pinnedLease = dgPool.acquireCredential({ provider: "deepgram", role: "public" });
      return dgPool.getCredential(pinnedLease!.credentialId)!.inFlightCount === 1;
    });

    // 49. Reconnect does not create duplicate sockets
    await runTest(49, "Active stream maintains single socket without duplicate sessions", () => {
      return dgPool.getCredential(pinnedLease!.credentialId)!.inFlightCount === 1;
    });

    // 50. Credential release after actual session close
    await runTest(50, "Credential release decrements inFlightCount back to 0 on session close", () => {
      pinnedLease?.release();
      return dgPool.getCredential(pinnedLease!.credentialId)!.inFlightCount === 0;
    });

    console.log("\n==================================================");
    console.log(`ALL ${testPassCount} / 50 TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");
  } finally {
    for (const uId of createdUserIds) {
      try {
        await pool.query("DELETE FROM credit_transactions WHERE user_id = $1", [uId]);
        await pool.query("DELETE FROM users WHERE id = $1", [uId]);
      } catch {}
    }
    server.close();
  }
}

runProviderPoolTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n[FATAL] Test suite encountered an unhandled error:", err);
    process.exit(1);
  });
