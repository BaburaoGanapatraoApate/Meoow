import assert from "node:assert/strict";
import { providerKeyPool } from "./services/providerKeyPool";
import {
  analyzeMcqScreenshot,
  validateMcqAnswer,
  type McqCompletionRunner,
} from "./services/mcqAssistantService";
import { requireMcqAssistantAdmin } from "./middleware/mcqAssistantAuth";
import { pool } from "./db/database";

const fakeEnv = {
  GROQ_API_KEY1: "test-key-1-aaaaaaaa",
  GROQ_API_KEY2: "test-key-2-bbbbbbbb",
  GROQ_API_KEY3: "test-key-3-cccccccc",
  GROQ_API_KEY4: "test-key-4-dddddddd",
  GROQ_API_KEY5: "test-key-5-eeeeeeee",
};

const input = {
  imageBase64: "a".repeat(200),
  mimeType: "image/jpeg" as const,
  config: {
    category: "Machine Learning",
    subject: "Classification",
    difficulty: "medium" as const,
    language: "en",
    instructions: "Use the visible options only.",
  },
};

async function run() {
  assert.equal(validateMcqAnswer("C) XGBoost"), "C) XGBoost");
  assert.equal(validateMcqAnswer("A) First option; C) Third option"), "A) First option; C) Third option");
  assert.equal(validateMcqAnswer("The correct answer is C"), null);
  assert.equal(validateMcqAnswer("C) XGBoost\nBecause it is correct"), null);

  const originalQuery = pool.query.bind(pool);
  const makeResponse = () => {
    const response: any = {
      statusCode: 200,
      body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; },
    };
    return response;
  };

  const unauthenticatedResponse = makeResponse();
  await requireMcqAssistantAdmin({} as any, unauthenticatedResponse, (() => {}) as any);
  assert.equal(unauthenticatedResponse.statusCode, 401);

  (pool as any).query = async () => ({ rows: [{ email: "someone@example.com", status: "active" }] });
  const unauthorizedResponse = makeResponse();
  let unauthorizedNext = false;
  await requireMcqAssistantAdmin(
    { userId: "test-user" } as any,
    unauthorizedResponse,
    (() => { unauthorizedNext = true; }) as any
  );
  assert.equal(unauthorizedResponse.statusCode, 403);
  assert.equal(unauthorizedNext, false);

  (pool as any).query = async () => ({ rows: [{ email: "YEOLEKRUSHNAR@GMAIL.COM", status: "active" }] });
  const authorizedResponse = makeResponse();
  let authorizedNext = false;
  await requireMcqAssistantAdmin(
    { userId: "test-user" } as any,
    authorizedResponse,
    (() => { authorizedNext = true; }) as any
  );
  assert.equal(authorizedNext, true);
  (pool as any).query = originalQuery;

  providerKeyPool.initializePool(fakeEnv);
  const modelCalls: string[] = [];
  const timeoutThenFallback: McqCompletionRunner = async ({ model }) => {
    modelCalls.push(model);
    if (modelCalls.length === 1) {
      const err: any = new Error("timeout");
      err.status = 408;
      throw err;
    }
    return "B) Linear Regression";
  };
  const fallbackResult = await analyzeMcqScreenshot(input, timeoutThenFallback);
  assert.equal(fallbackResult.answer, "B) Linear Regression");
  assert.equal(modelCalls.length, 2, "timeout must retry the supported vision model with the next eligible key");
  assert.ok(modelCalls.every(model => model === "qwen/qwen3.8-27b"), "retired vision models must not be attempted");

  providerKeyPool.initializePool(fakeEnv);
  const orderedImages = ["first-image", "second-image"];
  const directMulti: McqCompletionRunner = async ({ images }) => {
    assert.deepEqual(images.map(image => image.imageBase64), orderedImages, "direct multi-image input must remain chronological");
    return "C) XGBoost";
  };
  assert.equal((await analyzeMcqScreenshot({
    ...input,
    imageBase64: undefined,
    mimeType: undefined,
    images: orderedImages.map(imageBase64 => ({ imageBase64, mimeType: "image/jpeg" as const })),
  }, directMulti)).answer, "C) XGBoost");

  providerKeyPool.initializePool(fakeEnv);
  const batchSizes: number[] = [];
  let batchCall = 0;
  const longQuestionRunner: McqCompletionRunner = async ({ images }) => {
    batchSizes.push(images.length);
    batchCall++;
    if (batchCall <= 2) return `ordered observation ${batchCall}`;
    return "A) Random Forest";
  };
  const longImages = Array.from({ length: 5 }, (_, index) => ({
    imageBase64: `image-${index + 1}`,
    mimeType: "image/jpeg" as const,
  }));
  assert.equal((await analyzeMcqScreenshot({ ...input, imageBase64: undefined, mimeType: undefined, images: longImages }, longQuestionRunner)).answer, "A) Random Forest");
  assert.deepEqual(batchSizes, [3, 2, 0], "more than three images must use ordered 3-image batches and one final answer pass");

  providerKeyPool.initializePool(fakeEnv);
  const rateLimitKeys: string[] = [];
  const rateLimitThenNextKey: McqCompletionRunner = async ({ apiKey }) => {
    rateLimitKeys.push(apiKey);
    if (apiKey === fakeEnv.GROQ_API_KEY1) {
      const err: any = new Error("rate limit");
      err.status = 429;
      err.headers = { "retry-after": "20" };
      throw err;
    }
    return "D) K-Means";
  };
  const rotatedResult = await analyzeMcqScreenshot(input, rateLimitThenNextKey);
  assert.equal(rotatedResult.answer, "D) K-Means");
  assert.equal(rateLimitKeys[0], fakeEnv.GROQ_API_KEY1);
  assert.equal(rateLimitKeys[1], fakeEnv.GROQ_API_KEY2, "429 must rotate to the next key");

  providerKeyPool.initializePool(fakeEnv);
  const authKeys: string[] = [];
  const authThenNextKey: McqCompletionRunner = async ({ apiKey }) => {
    authKeys.push(apiKey);
    if (apiKey === fakeEnv.GROQ_API_KEY1) {
      const err: any = new Error("invalid_api_key");
      err.status = 401;
      err.code = "invalid_api_key";
      throw err;
    }
    return "A) Random Forest";
  };
  assert.equal((await analyzeMcqScreenshot(input, authThenNextKey)).answer, "A) Random Forest");
  assert.equal(authKeys[1], fakeEnv.GROQ_API_KEY2, "authentication failure must rotate keys");

  providerKeyPool.initializePool(fakeEnv);
  let exhaustedCalls = 0;
  const alwaysLimited: McqCompletionRunner = async () => {
    exhaustedCalls++;
    const err: any = new Error("rate limit");
    err.status = 429;
    throw err;
  };
  await assert.rejects(
    () => analyzeMcqScreenshot(input, alwaysLimited),
    /All configured models are currently unavailable/
  );
  assert.equal(exhaustedCalls, 5, "all five configured keys must be attempted once");

  providerKeyPool.initializePool(process.env);
  console.log("MCQ Assistant tests passed: authorization, single/multiple-answer validation, chronological multi-image input, ordered batching, model/key fallback, and five-key exhaustion.");
}

run().catch((error) => {
  providerKeyPool.initializePool(process.env);
  console.error(error);
  process.exitCode = 1;
});
