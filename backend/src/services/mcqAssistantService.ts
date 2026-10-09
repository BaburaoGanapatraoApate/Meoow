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

export interface McqQuestionDetail {
  number?: number | string;
  status: "COMPLETE" | "INCOMPLETE" | "UNREADABLE";
  answer?: string;
  incompleteReason?: string;
}

export interface McqAnalysisResult {
  answer: string;
  model: string;
  incompleteNotification?: string;
  questions?: McqQuestionDetail[];
}

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

export interface ParsedMcqQuestion {
  number?: number | string;
  isComplete: boolean;
  validatedAnswer?: string;
  incompleteReason?: string;
  failedValidation?: boolean;
}

export interface ProcessedMcqResult {
  answer: string | null;
  incompleteNotification?: string;
  questions: ParsedMcqQuestion[];
  specialStatus?: "NO_MCQ" | "UNREADABLE" | "INCOMPLETE" | "AMBIGUOUS";
}

function validateSingleOptionString(part: string): string | null {
  const match = part.trim().match(/^([A-Z])\s*[).:\-]\s*(.+)$/);
  if (!match) return null;
  const optionLetter = match[1];
  const optionText = match[2].trim();
  if (!optionText || /^(the correct answer|answer|explanation|reasoning|because)\b/i.test(optionText)) return null;
  return `${optionLetter}) ${optionText}`;
}

export function validateSingleAnswer(raw: string): string | null {
  const value = raw.trim();
  if (["NO_MCQ", "UNREADABLE", "INCOMPLETE", "AMBIGUOUS"].includes(value)) return value;
  const parts = value.split(/\s*;\s*/).filter(Boolean);
  if (!parts.length) return null;
  const normalized: string[] = [];
  for (const part of parts) {
    const validated = validateSingleOptionString(part);
    if (!validated) return null;
    normalized.push(validated);
  }
  return normalized.join("; ");
}

export function checkDivisibility(stem: string, options: Record<string, string>): { letter: string; text: string; reason: string } | null {
  const isLargest = /(?:largest|greatest|maximum|highest)/i.test(stem);
  const isSmallest = /(?:smallest|least|minimum|lowest)/i.test(stem);
  const divMatch = stem.match(/(?:divisible by|multiple of)\s*(\d+)/i);
  if (!divMatch) return null;

  const divisor = parseInt(divMatch[1], 10);
  if (isNaN(divisor) || divisor <= 0) return null;

  const validDivisible: Array<{ letter: string; text: string; num: number }> = [];
  for (const [letter, text] of Object.entries(options)) {
    const num = parseInt(text.replace(/[^\d-]/g, ""), 10);
    if (!isNaN(num) && num % divisor === 0) {
      validDivisible.push({ letter, text, num });
    }
  }

  if (validDivisible.length === 0) return null;

  if (isLargest) {
    validDivisible.sort((a, b) => b.num - a.num);
    const best = validDivisible[0];
    return { letter: best.letter, text: best.text, reason: `Largest number divisible by ${divisor} is ${best.num}` };
  } else if (isSmallest) {
    validDivisible.sort((a, b) => a.num - b.num);
    const best = validDivisible[0];
    return { letter: best.letter, text: best.text, reason: `Smallest number divisible by ${divisor} is ${best.num}` };
  }

  if (validDivisible.length === 1) {
    return { letter: validDivisible[0].letter, text: validDivisible[0].text, reason: `Only option divisible by ${divisor} is ${validDivisible[0].num}` };
  }

  return null;
}

export function checkRemainder(stem: string, options: Record<string, string>): { letter: string; text: string; reason: string } | null {
  const m = stem.match(/dividing.*?by\s*(\d+)[^.]*?(\d+)\s+as\s+remainder.*?dividing.*?by\s*(\d+)/i);
  if (!m) return null;

  const d1 = parseInt(m[1], 10);
  const r1 = parseInt(m[2], 10);
  const d2 = parseInt(m[3], 10);

  if (isNaN(d1) || isNaN(r1) || isNaN(d2) || d2 <= 0) return null;

  if (d1 % d2 === 0) {
    const expectedRemainder = r1 % d2;
    for (const [letter, text] of Object.entries(options)) {
      const num = parseInt(text.replace(/[^\d-]/g, ""), 10);
      if (num === expectedRemainder) {
        return { letter, text, reason: `${d1} is divisible by ${d2}, so remainder is ${r1} % ${d2} = ${expectedRemainder}` };
      }
    }
  }
  return null;
}

export function checkNotPrime(stem: string, options: Record<string, string>): { letter: string; text: string; reason: string } | null {
  if (!/not\s+a\s+prime\s+number/i.test(stem)) return null;

  function isPrime(n: number): boolean {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }

  for (const [letter, text] of Object.entries(options)) {
    const num = parseInt(text.replace(/[^\d-]/g, ""), 10);
    if (!isNaN(num) && !isPrime(num)) {
      return { letter, text, reason: `${num} is not prime` };
    }
  }
  return null;
}

export function checkPercentageArithmetic(stem: string, options: Record<string, string>): { letter: string; text: string; reason: string } | null {
  const m = stem.match(/(\d+)%\s*of\s*(\d+)\s*([+\-*])\s*(\d+)%\s*of\s*(\d+)/i);
  if (!m) return null;

  const p1 = parseFloat(m[1]) / 100 * parseFloat(m[2]);
  const op = m[3];
  const p2 = parseFloat(m[4]) / 100 * parseFloat(m[5]);
  let result = 0;
  if (op === "+") result = p1 + p2;
  else if (op === "-") result = p1 - p2;
  else if (op === "*") result = p1 * p2;

  for (const [letter, text] of Object.entries(options)) {
    const num = parseFloat(text.replace(/[^\d.-]/g, ""));
    if (Math.abs(num - result) < 0.001) {
      return { letter, text, reason: `Exact arithmetic: ${p1} ${op} ${p2} = ${result}` };
    }
  }
  return null;
}

export function deterministicVerification(stem: string, options: Record<string, string>): { letter: string; text: string; reason: string } | null {
  return checkDivisibility(stem, options) ||
         checkRemainder(stem, options) ||
         checkNotPrime(stem, options) ||
         checkPercentageArithmetic(stem, options);
}

export function parseAndValidateMcq(raw: string): ProcessedMcqResult {
  const text = raw.trim();
  if (["NO_MCQ", "UNREADABLE", "INCOMPLETE", "AMBIGUOUS"].includes(text)) {
    return { answer: null, specialStatus: text as any, questions: [] };
  }

  // Check JSON format first
  let jsonQuestions: any[] | null = null;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
  const candidateJson = (jsonMatch[1] || text).trim();
  if (candidateJson.startsWith("{") || candidateJson.startsWith("[")) {
    try {
      const parsed = JSON.parse(candidateJson);
      if (Array.isArray(parsed)) {
        jsonQuestions = parsed;
      } else if (parsed && Array.isArray(parsed.questions)) {
        jsonQuestions = parsed.questions;
      }
    } catch {}
  }

  const questions: ParsedQuestionInternal[] = [];

  interface ParsedQuestionInternal {
    number?: number | string;
    isComplete: boolean;
    validatedAnswer?: string;
    incompleteReason?: string;
    failedValidation?: boolean;
  }

  if (jsonQuestions) {
    for (let i = 0; i < jsonQuestions.length; i++) {
      const item = jsonQuestions[i];
      const qNum = item.number !== undefined ? String(item.number) : String(i + 1);
      const status = String(item.status || (item.isComplete === false ? "INCOMPLETE" : "COMPLETE")).toUpperCase();
      if (status === "INCOMPLETE" || item.isComplete === false) {
        questions.push({
          number: qNum,
          isComplete: false,
          incompleteReason: item.reason || item.incompleteReason || "Question incomplete",
        });
      } else {
        const rawAns = String(item.answer || item.selectedOption || "").trim();
        const validated = validateSingleAnswer(rawAns);
        if (validated) {
          questions.push({
            number: qNum,
            isComplete: true,
            validatedAnswer: validated,
          });
        } else {
          questions.push({
            number: qNum,
            isComplete: false,
            failedValidation: true,
          });
        }
      }
    }
  } else {
    // Line-based parsing
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Reject reasoning/explanation when single unnumbered answer has trailing text
    const firstLineMatch = lines[0]?.match(/^(?:question|q)?\s*(\d+)[\s.:)\-]+\s*(.+)$/i);
    if (!firstLineMatch && lines.length > 1) {
      const hasNumbered = lines.some(l => /^(?:question|q)?\s*\d+[\s.:)\-]/i.test(l));
      if (!hasNumbered) {
        return { answer: null, questions: [{ isComplete: false, failedValidation: true }] };
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const numMatch = line.match(/^(?:question|q)?\s*(\d+)[\s.:)\-]+\s*(.+)$/i);
      if (numMatch) {
        const qNum = numMatch[1];
        const content = numMatch[2].trim();
        if (/^(INCOMPLETE|PARTIAL|TRUNCATED|CUT\s*OFF|MISSING)/i.test(content)) {
          questions.push({
            number: qNum,
            isComplete: false,
            incompleteReason: content,
          });
        } else {
          const validated = validateSingleAnswer(content);
          if (validated) {
            questions.push({
              number: qNum,
              isComplete: true,
              validatedAnswer: validated,
            });
          } else {
            questions.push({
              number: qNum,
              isComplete: false,
              failedValidation: true,
            });
          }
        }
      } else {
        if (/^(INCOMPLETE|PARTIAL|TRUNCATED|CUT\s*OFF|MISSING)/i.test(line)) {
          questions.push({
            number: questions.length + 1,
            isComplete: false,
            incompleteReason: line,
          });
        } else {
          const validated = validateSingleAnswer(line);
          if (validated) {
            questions.push({
              number: lines.length === 1 ? undefined : questions.length + 1,
              isComplete: true,
              validatedAnswer: validated,
            });
          } else if (lines.length === 1) {
            questions.push({
              isComplete: false,
              failedValidation: true,
            });
          }
        }
      }
    }
  }

  // Deduplicate by question number, updating incomplete questions with complete ones if available
  const seenNumbers = new Set<string>();
  const deduplicated: ParsedQuestionInternal[] = [];
  for (const q of questions) {
    const key = q.number !== undefined ? String(q.number).trim() : "";
    if (key && seenNumbers.has(key)) {
      const existing = deduplicated.find(x => String(x.number).trim() === key);
      if (existing && !existing.isComplete && q.isComplete) {
        existing.isComplete = true;
        existing.validatedAnswer = q.validatedAnswer;
        delete existing.incompleteReason;
      }
      continue;
    }
    if (key) seenNumbers.add(key);
    deduplicated.push(q);
  }

  const complete = deduplicated.filter(q => q.isComplete && q.validatedAnswer);
  const incomplete = deduplicated.filter(q => !q.isComplete && !q.failedValidation);

  let formattedAnswer: string | null = null;
  if (complete.length === 1 && complete[0].number === undefined) {
    formattedAnswer = complete[0].validatedAnswer!;
  } else if (complete.length === 1 && deduplicated.length === 1) {
    formattedAnswer = complete[0].number !== undefined ? `${complete[0].number}. ${complete[0].validatedAnswer}` : complete[0].validatedAnswer!;
  } else if (complete.length > 0) {
    formattedAnswer = complete.map((q, idx) => {
      const num = q.number !== undefined ? q.number : idx + 1;
      return `${num}. ${q.validatedAnswer}`;
    }).join("\n");
  }

  let incompleteNotification: string | undefined;
  if (incomplete.length > 0) {
    const nums = incomplete.map(q => q.number).filter(Boolean);
    if (nums.length === 1) {
      incompleteNotification = `Question ${nums[0]} incomplete — add another capture`;
    } else if (nums.length > 1) {
      incompleteNotification = `Questions ${nums.join(", ")} incomplete — add another capture`;
    } else {
      incompleteNotification = "Question incomplete — add another capture";
    }
  }

  return {
    answer: formattedAnswer,
    incompleteNotification,
    questions: deduplicated,
  };
}

export function validateMcqAnswer(raw: string): string | null {
  const value = raw.trim();
  if (["NO_MCQ", "UNREADABLE", "INCOMPLETE", "AMBIGUOUS"].includes(value)) return value;
  const result = parseAndValidateMcq(raw);
  return result.answer;
}

export function buildMcqPrompt(config: McqAssistantConfig, imageCount = 1): string {
  return [
    `The ${imageCount} chronological image(s) capture one or more multiple-choice questions (MCQs). Overlapping images represent continued context.`,
    "INSTRUCTIONS:",
    "1. Scan top-to-bottom. Identify every distinct MCQ and its question number (e.g., 1, 2, 3...) or sequential order if unnumbered.",
    "2. For each question, extract its stem, relevant passage/table/code/formula/diagram context, and all visible options (e.g. A, B, C, D, E).",
    "3. Determine completeness for each question independently:",
    "   - COMPLETE: The question stem and its answer choices are sufficiently visible to solve definitively.",
    "   - INCOMPLETE: The question stem or options are clipped, truncated, cut off (e.g. at the bottom of the screenshot), or missing required choices.",
    "4. SOLVING & REASONING PROTOCOL (CRITICAL):",
    "   - Solve each complete question independently by thinking step-by-step from first principles in your internal scratchpad.",
    "   - For mathematics, divisibility, remainders, arithmetic, and quantitative problems: calculate exact numbers from scratch. If asked for 'largest' or 'smallest' satisfying a property, verify that all other candidates do not violate the extremum.",
    "   - For logical qualifiers: strictly honor NOT, EXCEPT, LEAST, ALWAYS, NEVER.",
    "   - For code, tables, and logic: trace execution steps, variable mutations, and row values carefully.",
    "   - Output the chosen option letter and EXACT visible option text.",
    "   - Single answer format: C) exact visible option text",
    "   - Multiple answers format: A) exact text; C) exact text",
    "   - Never invent options, alter option letters, or output scratchpad thoughts in the final response.",
    "5. For any INCOMPLETE question, mark it INCOMPLETE (e.g. 3. INCOMPLETE). Never let an incomplete question prevent answering other complete questions.",
    "6. FORMAT YOUR RESPONSE:",
    "   Provide each question on its own line in order, like this:",
    "   1. A) 9944",
    "   2. C) 5",
    "   3. INCOMPLETE",
    "   If only a single unnumbered question is present on the screen:",
    "   C) exact option text",
    "   (If no questions exist at all, return NO_MCQ. If completely unreadable, return UNREADABLE).",
    `Test category: ${config.category}`,
    `Subject/domain: ${config.subject || "Not specified"}`,
    `Difficulty: ${config.difficulty}`,
    `Configured language: ${config.language}`,
    config.instructions ? `Session instructions: ${config.instructions}` : "",
  ].filter(Boolean).join("\n");
}

const defaultCompletionRunner: McqCompletionRunner = async ({ apiKey, model, images, prompt, signal, maxTokens = 2048 }) => {
  const client = new Groq({ apiKey });
  const content: any[] = [{ type: "text", text: prompt }];
  for (const image of images) {
    content.push({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.imageBase64}` } });
  }
  const params: any = {
    model,
    messages: [{ role: "user", content }],
    max_tokens: maxTokens,
    temperature: 0,
    reasoning_format: "hidden",
  };
  if (model.includes("qwen") || model === "qwen/qwen3.8-27b") {
    params.reasoning_effort = "high";
  }
  const response: any = await client.chat.completions.create(params, { signal });
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
      prompt: buildMcqPrompt(config, images.length), maxTokens: 2048,
    });
  }

  const observations: string[] = [];
  for (let offset = 0; offset < images.length; offset += MAX_IMAGES_PER_MODEL_REQUEST) {
    const batch = images.slice(offset, offset + MAX_IMAGES_PER_MODEL_REQUEST);
    const batchNumber = Math.floor(offset / MAX_IMAGES_PER_MODEL_REQUEST) + 1;
    const observation = await runWithTimeout(runner, {
      apiKey, model, images: batch, imageBase64: batch[0]?.imageBase64, mimeType: batch[0]?.mimeType,
      prompt: [
        `These are chronological images ${offset + 1}-${offset + batch.length} of an assessment page containing one or more MCQs.`,
        "Transcribe only visible question stems with question numbers, passage text, option letters and exact option text, formulas, code indentation, and objective chart/diagram/table labels.",
        "Note continuation and overlap with adjacent captures. Do not solve and do not infer missing content.",
      ].join("\n"),
      maxTokens: 2048,
    });
    if (!observation.trim()) throw new Error(`Empty observation for image batch ${batchNumber}`);
    observations.push(`[ORDERED BATCH ${batchNumber}]\n${observation.trim()}`);
  }
  return runWithTimeout(runner, {
    apiKey, model, images: [],
    prompt: `${buildMcqPrompt(config, images.length)}\n\nOrdered visual observations:\n${observations.join("\n\n")}`,
    maxTokens: 2048,
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
          const parsed = parseAndValidateMcq(raw);

          if (parsed.specialStatus === "NO_MCQ") {
            providerKeyPool.recordSuccess(lease.credentialId, model);
            return { answer: "Question incomplete - add another capture", model };
          }
          if (parsed.specialStatus === "AMBIGUOUS") {
            providerKeyPool.recordSuccess(lease.credentialId, model);
            return { answer: "Question ambiguous - capture the intended question more clearly", model };
          }
          if (parsed.specialStatus === "UNREADABLE") {
            sawUnreadable = true;
            lastKeyError = new Error("unreadable");
            continue;
          }

          if (parsed.answer) {
            providerKeyPool.recordSuccess(lease.credentialId, model);
            return {
              answer: parsed.answer,
              model,
              incompleteNotification: parsed.incompleteNotification,
              questions: parsed.questions.map(q => ({
                number: q.number,
                status: q.isComplete ? "COMPLETE" : "INCOMPLETE",
                answer: q.validatedAnswer,
                incompleteReason: q.incompleteReason,
              })),
            };
          }

          if (parsed.specialStatus === "INCOMPLETE" || parsed.incompleteNotification || parsed.questions.some(q => !q.isComplete)) {
            providerKeyPool.recordSuccess(lease.credentialId, model);
            return {
              answer: "Question incomplete - add another capture",
              model,
              incompleteNotification: parsed.incompleteNotification,
              questions: parsed.questions.map(q => ({
                number: q.number,
                status: "INCOMPLETE",
                incompleteReason: q.incompleteReason,
              })),
            };
          }

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
