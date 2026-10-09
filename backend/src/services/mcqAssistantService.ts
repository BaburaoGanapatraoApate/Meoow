import Groq from "groq-sdk";
import { providerKeyPool } from "./providerKeyPool";
import { DEFAULT_VISION_MODEL, FALLBACK_VISION_MODEL } from "./groqService";

const MODEL_SEQUENCE = Array.from(new Set([FALLBACK_VISION_MODEL, DEFAULT_VISION_MODEL]));
const MAX_KEYS_PER_REQUEST = 5;
export const MAX_IMAGES_PER_MODEL_REQUEST = 3;
const REQUEST_TIMEOUT_MS = 25_000;

export interface McqAssistantConfig {
  category: string;
  subject?: string;
  difficulty: "any" | "easy" | "medium" | "hard";
  language: string;
  instructions?: string;
}

export interface McqImageInput {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png";
}

export interface McqAnalysisResult { answer: string; model: string; }

export type McqCompletionRunner = (args: {
  apiKey: string;
  model: string;
  images: McqImageInput[];
  imageBase64?: string;
  mimeType?: "image/jpeg" | "image/png";
  prompt: string;
  signal: AbortSignal;
  maxTokens?: number;
}) => Promise<string>;

export function validateMcqAnswer(raw: string): string | null {
  const value = raw.trim();
  if (["NO_MCQ", "UNREADABLE", "INCOMPLETE", "AMBIGUOUS"].includes(value)) return value;
  if (value.includes("\n") || value.length > 600) return null;
  const parts = value.split(/\s*;\s*/).filter(Boolean);
  if (!parts.length) return null;
  const normalized: string[] = [];
  for (const part of parts) {
    const match = part.match(/^([A-Z])\s*[).:\-]\s*(.+)$/);
    if (!match) return null;
    const optionText = match[2].trim();
    if (!optionText || /^(the correct answer|answer|explanation|reasoning)\b/i.test(optionText)) return null;
    normalized.push(`${match[1]}) ${optionText}`);
  }
  return normalized.join("; ");
}

export function buildMcqPrompt(config: McqAssistantConfig, imageCount = 1): string {
  return [
    `The ${imageCount} image(s) are chronological captures of one current MCQ. Consecutive images may overlap; treat overlap as repeated context, not separate questions.`,
    "Identify the complete stem, relevant passage, table, chart, diagram, formulas or code, and all visible options before solving.",
    "Read NOT, EXCEPT, LEAST, assertion-reason, all/none-of-the-above, and multiple-answer instructions exactly.",
    "For one answer return exactly: C) exact visible option text. For multiple answers return: A) exact text; C) exact text.",
    "Selected letters must exist in the visible options and their text must match. Do not explain, use markdown, invent options, or alter letters.",
    "Return exactly INCOMPLETE if the stem/options continue beyond the captures; UNREADABLE if essential detail cannot be read; AMBIGUOUS if multiple questions are equally prominent; NO_MCQ if no MCQ exists.",
    `Test category: ${config.category}`,
    `Subject/domain: ${config.subject || "Not specified"}`,
    `Difficulty: ${config.difficulty}`,
    `Configured language: ${config.language}`,
    config.instructions ? `Session instructions: ${config.instructions}` : "",
  ].filter(Boolean).join("\n");
}

const defaultCompletionRunner: McqCompletionRunner = async ({ apiKey, model, images, prompt, signal, maxTokens = 160 }) => {
  const client = new Groq({ apiKey });
  const content: any[] = [{ type: "text", text: prompt }];
  for (const image of images) {
    content.push({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.imageBase64}` } });
  }
  const response: any = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content }],
    max_tokens: maxTokens,
    temperature: 0,
    reasoning_format: "hidden",
  }, { signal });
  return response?.choices?.[0]?.message?.content || "";
};

function errorDetails(err: any): { status?: number; code?: string; message: string } {
  return {
    status: err?.status || err?.statusCode || err?.response?.status,
    code: err?.code || err?.error?.code || err?.type,
    message: String(err?.message || err?.error?.message || "").toLowerCase(),
  };
}

async function runWithTimeout(runner: McqCompletionRunner, args: Omit<Parameters<McqCompletionRunner>[0], "signal">) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await runner({ ...args, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

async function analyzeWithModel(apiKey: string, model: string, images: McqImageInput[], config: McqAssistantConfig, runner: McqCompletionRunner) {
  if (images.length <= MAX_IMAGES_PER_MODEL_REQUEST) {
    return runWithTimeout(runner, {
      apiKey, model, images, imageBase64: images[0]?.imageBase64, mimeType: images[0]?.mimeType,
      prompt: buildMcqPrompt(config, images.length), maxTokens: 160,
    });
  }

  const observations: string[] = [];
  for (let offset = 0; offset < images.length; offset += MAX_IMAGES_PER_MODEL_REQUEST) {
    const batch = images.slice(offset, offset + MAX_IMAGES_PER_MODEL_REQUEST);
    const batchNumber = Math.floor(offset / MAX_IMAGES_PER_MODEL_REQUEST) + 1;
    const observation = await runWithTimeout(runner, {
      apiKey, model, images: batch, imageBase64: batch[0]?.imageBase64, mimeType: batch[0]?.mimeType,
      prompt: [
        `These are chronological images ${offset + 1}-${offset + batch.length} from one long MCQ.`,
        "Transcribe only visible question/passage text, option letters and exact option text, formulas, code indentation, and objective chart/diagram/table labels.",
        "Note continuation and overlap with adjacent captures. Do not solve and do not infer missing content.",
      ].join("\n"),
      maxTokens: 900,
    });
    if (!observation.trim()) throw new Error(`Empty observation for image batch ${batchNumber}`);
    observations.push(`[ORDERED BATCH ${batchNumber}]\n${observation.trim()}`);
  }
  return runWithTimeout(runner, {
    apiKey, model, images: [],
    prompt: `${buildMcqPrompt(config, images.length)}\n\nOrdered visual observations:\n${observations.join("\n\n")}`,
    maxTokens: 180,
  });
}

export async function analyzeMcqScreenshot(
  input: { images?: McqImageInput[]; imageBase64?: string; mimeType?: "image/jpeg" | "image/png"; config: McqAssistantConfig },
  runner: McqCompletionRunner = defaultCompletionRunner
): Promise<McqAnalysisResult> {
  const images = input.images?.length ? input.images : input.imageBase64 && input.mimeType
    ? [{ imageBase64: input.imageBase64, mimeType: input.mimeType }] : [];
  if (!images.length) {
    const error: any = new Error("Question incomplete - add another capture");
    error.status = 400; error.code = "EMPTY_CAPTURE_COLLECTION"; throw error;
  }

  const attemptedCredentialIds = new Set<string>();
  const eligibleCount = providerKeyPool.getEligibleCount({ provider: "groq", role: "public" });
  const maxKeys = Math.min(MAX_KEYS_PER_REQUEST, eligibleCount);
  let sawUnreadable = false;

  while (attemptedCredentialIds.size < maxKeys) {
    const lease = providerKeyPool.acquireCredential({ provider: "groq", role: "public", excludeIds: attemptedCredentialIds });
    if (!lease) break;
    attemptedCredentialIds.add(lease.credentialId);
    let lastKeyError: any = null;
    try {
      for (const model of MODEL_SEQUENCE) {
        try {
          const raw = await analyzeWithModel(lease.apiKey, model, images, input.config, runner);
          const answer = validateMcqAnswer(raw);
          if (answer === "NO_MCQ" || answer === "INCOMPLETE") {
            providerKeyPool.recordSuccess(lease.credentialId, model);
            return { answer: "Question incomplete - add another capture", model };
          }
          if (answer === "AMBIGUOUS") {
            providerKeyPool.recordSuccess(lease.credentialId, model);
            return { answer: "Question ambiguous - capture the intended question more clearly", model };
          }
          if (answer === "UNREADABLE") { sawUnreadable = true; lastKeyError = new Error("unreadable"); continue; }
          if (answer) { providerKeyPool.recordSuccess(lease.credentialId, model); return { answer, model }; }
          lastKeyError = new Error("Invalid MCQ answer format");
        } catch (err: any) {
          lastKeyError = err;
          const details = errorDetails(err);
          const credentialFailure = details.status === 401 || details.status === 403 || details.status === 429 ||
            details.code === "invalid_api_key" || details.message.includes("rate limit");
          if (credentialFailure) { providerKeyPool.recordError(lease.credentialId, err); break; }
        }
      }
      if (lastKeyError) {
        const details = errorDetails(lastKeyError);
        if (details.status && details.status >= 500) providerKeyPool.recordError(lease.credentialId, lastKeyError);
      }
    } finally { lease.release(); }
  }

  if (sawUnreadable) {
    const error: any = new Error("Image unreadable - retake the screenshot");
    error.status = 422; error.code = "MCQ_IMAGE_UNREADABLE"; throw error;
  }
  const error: any = new Error("All configured models are currently unavailable. Please try again shortly.");
  error.status = 503; error.code = "MCQ_MODELS_UNAVAILABLE"; throw error;
}

export const MCQ_ASSISTANT_MODEL_SEQUENCE = MODEL_SEQUENCE;
