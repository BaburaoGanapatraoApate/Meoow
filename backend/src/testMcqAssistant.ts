import assert from "node:assert/strict";
import { providerKeyPool } from "./services/providerKeyPool";
import {
  analyzeMcqScreenshot,
  validateMcqAnswer,
  parseAndValidateMcq,
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
  // ── Baseline Validation Unit Tests ──
  assert.equal(validateMcqAnswer("C) XGBoost"), "C) XGBoost");
  assert.equal(validateMcqAnswer("A) First option; C) Third option"), "A) First option; C) Third option");
  assert.equal(validateMcqAnswer("The correct answer is C"), null);
  assert.equal(validateMcqAnswer("C) XGBoost\nBecause it is correct"), null);

  // ── Exact Mandatory Regression Fixture ──
  // Question 1: "The largest 4 digit number exactly divisible by 88 is:" -> 1. A) 9944
  // Question 2: "On dividing a number by 357, we get 39 as remainder..." -> 2. C) 5
  // Question 3: Clipped at bottom -> 3. INCOMPLETE
  const fixtureRaw = `1. A) 9944\n2. C) 5\n3. INCOMPLETE`;
  const fixtureParsed = parseAndValidateMcq(fixtureRaw);
  assert.equal(fixtureParsed.answer, "1. A) 9944\n2. C) 5", "complete questions must be returned and formatted line-by-line");
  assert.equal(fixtureParsed.incompleteNotification, "Question 3 incomplete — add another capture", "clipped question must be flagged without invalidating complete questions");

  // Multi-question answer validation via validateMcqAnswer
  assert.equal(validateMcqAnswer(fixtureRaw), "1. A) 9944\n2. C) 5");

  // ── Three complete questions in one screenshot ──
  const threeCompleteRaw = `1. A) 9944\n2. C) 5\n3. B) 6999300`;
  const threeCompleteParsed = parseAndValidateMcq(threeCompleteRaw);
  assert.equal(threeCompleteParsed.answer, "1. A) 9944\n2. C) 5\n3. B) 6999300");
  assert.equal(threeCompleteParsed.incompleteNotification, undefined);

  // ── Screenshot containing only an incomplete question ──
  const onlyIncompleteRaw = `3. INCOMPLETE (clipped at bottom)`;
  const onlyIncompleteParsed = parseAndValidateMcq(onlyIncompleteRaw);
  assert.equal(onlyIncompleteParsed.answer, null);
  assert.equal(onlyIncompleteParsed.incompleteNotification, "Question 3 incomplete — add another capture");

  // ── One failed answer validation while another answer remains valid ──
  const mixedValidationRaw = `1. A) 9944\n2. This is an invalid option text format without letter`;
  const mixedValidationParsed = parseAndValidateMcq(mixedValidationRaw);
  assert.equal(mixedValidationParsed.answer, "1. A) 9944", "valid answer must not be discarded when another answer fails validation");

  // ── Questions with more than 4 options (A through E) ──
  const optionERaw = `1. E) None of these`;
  const optionEParsed = parseAndValidateMcq(optionERaw);
  assert.equal(optionEParsed.answer, "1. E) None of these");

  // ── Multiple-answer questions ──
  const multiAnswerRaw = `1. A) 9944; C) 9988\n2. B) 17`;
  const multiAnswerParsed = parseAndValidateMcq(multiAnswerRaw);
  assert.equal(multiAnswerParsed.answer, "1. A) 9944; C) 9988\n2. B) 17");

  // ── Structured JSON response parsing & resilience ──
  const jsonResponseRaw = JSON.stringify({
    questions: [
      { number: 1, status: "COMPLETE", answer: "A) 9944" },
      { number: 2, status: "COMPLETE", answer: "C) 5" },
      { number: 3, status: "INCOMPLETE", reason: "Stem cut off at bottom of image" },
    ],
  });
  const jsonParsed = parseAndValidateMcq(jsonResponseRaw);
  assert.equal(jsonParsed.answer, "1. A) 9944\n2. C) 5");
  assert.equal(jsonParsed.incompleteNotification, "Question 3 incomplete — add another capture");

  // ── Deduplication of overlapping questions across captures ──
  // If Question 1 appears again or Question 2 was incomplete in pass 1 and completed in pass 2
  const overlappingSequenceRaw = `1. A) 9944\n2. INCOMPLETE\n2. C) 5\n3. INCOMPLETE`;
  const overlappingParsed = parseAndValidateMcq(overlappingSequenceRaw);
  assert.equal(overlappingParsed.answer, "1. A) 9944\n2. C) 5", "overlapping questions must update incomplete to complete and deduplicate");
  assert.equal(overlappingParsed.incompleteNotification, "Question 3 incomplete — add another capture");

  // ── End-to-end service call with exact regression fixture ──
  providerKeyPool.initializePool(fakeEnv);
  const fixtureRunner: McqCompletionRunner = async () => fixtureRaw;
  const fixtureServiceResult = await analyzeMcqScreenshot(input, fixtureRunner);
  assert.equal(fixtureServiceResult.answer, "1. A) 9944\n2. C) 5");
  assert.equal(fixtureServiceResult.incompleteNotification, "Question 3 incomplete — add another capture");
  assert.equal(fixtureServiceResult.questions?.length, 3);
  assert.equal(fixtureServiceResult.questions?.[0].status, "COMPLETE");
  assert.equal(fixtureServiceResult.questions?.[1].status, "COMPLETE");
  assert.equal(fixtureServiceResult.questions?.[2].status, "INCOMPLETE");

  // ── End-to-end service call with only incomplete question ──
  providerKeyPool.initializePool(fakeEnv);
  const onlyIncompleteRunner: McqCompletionRunner = async () => onlyIncompleteRaw;
  const onlyIncompleteServiceResult = await analyzeMcqScreenshot(input, onlyIncompleteRunner);
  assert.equal(onlyIncompleteServiceResult.answer, "Question incomplete - add another capture");
  assert.equal(onlyIncompleteServiceResult.incompleteNotification, "Question 3 incomplete — add another capture");

  // ── Authorization Middleware Tests ──
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

  // ── Vision Model & Key Rotation Tests ──
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

  // ── Multi-image Chronological Order Preservation ──
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

  // ── Ordered Batching for >3 Images ──
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

  // ── Rate Limit 429 Rotation ──
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

  // ── Authentication 401 Rotation ──
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

  // ── All 5 Keys Exhaustion ──
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
  console.log("MCQ Assistant tests passed: authorization, multi-question parsing, exact regression fixture, incomplete-question isolation, single/multiple-answer validation, chronological multi-image input, ordered batching, model/key fallback, and five-key exhaustion.");
}

run().catch((error) => {
  providerKeyPool.initializePool(process.env);
  console.error(error);
  process.exitCode = 1;
});
