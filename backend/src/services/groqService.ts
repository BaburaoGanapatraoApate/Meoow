import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

export const ALLOWED_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "groq/compound-mini",
  "groq/compound"
];

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const FALLBACK_MODEL = "qwen/qwen3.8-27b";

export const DEFAULT_VISION_MODEL = "qwen/qwen3.6-27b";
export const FALLBACK_VISION_MODEL = "qwen/qwen3.8-27b";
export const ALLOWED_VISION_MODELS = [
  "qwen/qwen3.6-27b",
  "qwen/qwen3.8-27b",
];

export interface SessionContextData {
  sessionId?: string;
  jobTitle?: string;
  job_title?: string;
  company?: string;
  experienceLevel?: string;
  experience_level?: string;
  interviewRound?: string;
  interview_round?: string;
  streamingModel?: string;
  streaming_model?: string;
  visionModel?: string;
  vision_model?: string;
  notes?: string;
  resumeText?: string;
  resume_text?: string;
  language?: string;
  source?: string;
}

export interface ChatStreamOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: any }>;
  model?: string;
  apiKey?: string;
  sessionContext?: SessionContextData;
  signal?: AbortSignal;
  onChunk?: (chunkText: string) => void;
}

export interface ScreenAnalysisOptions {
  imageBase64: string;
  question?: string;
  model?: string;
  apiKey?: string;
  sessionContext?: SessionContextData;
  signal?: AbortSignal;
  onChunk?: (chunkText: string) => void;
  requestId?: string;
  activeStreamsCount?: number;
}

export interface ScreenAnalysisResult {
  fullAnswer: string;
  modelUsed: string;
  isError?: boolean;
  errorCode?: string;
  retryAfterSeconds?: number;
}

export class GroqBackendService {
  private client: Groq | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      this.client = new Groq({ apiKey });
    }
  }

  private getClient(apiKeyOverride?: string): Groq {
    if (apiKeyOverride && apiKeyOverride.trim().length > 0) {
      return new Groq({ apiKey: apiKeyOverride.trim() });
    }
    if (!this.client) {
      this.initClient();
    }
    if (!this.client) {
      throw new Error("Groq client not initialized. Check GROQ_API_KEY in backend environment.");
    }
    return this.client;
  }

  public isConfigured(): boolean {
    return !!process.env.GROQ_API_KEY;
  }

  public resolveModel(requestedModel?: string): string {
    if (!requestedModel) return DEFAULT_MODEL;
    if (ALLOWED_MODELS.includes(requestedModel)) return requestedModel;
    return DEFAULT_MODEL;
  }

  public resolveVisionModel(requestedModel?: string): string {
    if (requestedModel && ALLOWED_VISION_MODELS.includes(requestedModel)) {
      return requestedModel;
    }
    return DEFAULT_VISION_MODEL;
  }

  public buildSystemPrompt(context?: SessionContextData): string {
    const jobTitle = context?.jobTitle || context?.job_title || "Software Engineer";
    const company = context?.company ? ` at ${context.company}` : "";
    const experienceLevel = context?.experienceLevel || context?.experience_level || "mid-level";
    const interviewRound = context?.interviewRound || context?.interview_round || "technical";

    const isHrRound =
      interviewRound === "hr_screening" ||
      interviewRound === "hr" ||
      interviewRound === "behavioral" ||
      interviewRound === "culture_fit";

    let prompt: string;

    if (isHrRound) {
      prompt = `You are the candidate in a live HR / behavioral job interview for a ${experienceLevel} ${jobTitle}${company} (${interviewRound} round).
You are answering the interviewer's questions in real time. Your persona is professional, articulate, positive, collaborative, and confident — the kind of well-rounded candidate a recruiter, HR lead, or hiring manager is excited to advance to the next round.

ANSWER FRAMEWORKS — use the right one for each question type:

1. "TELL ME ABOUT YOURSELF" / INTRO: Give a concise career narrative in 3-4 sentences — your background, core strengths, key achievements, and what excites you about this role and company.
2. BEHAVIORAL / SITUATIONAL ("Tell me about a time...", "How did you handle..."): Use the STAR method (Situation, Task, Action, Result) in 4-5 sentences. Focus on teamwork, conflict resolution, leadership, adaptability, ownership, or learning from challenges.
3. MOTIVATION & CULTURE FIT ("Why our company?", "Where do you see yourself in 5 years?"): Connect your personal career goals and work ethic with the company's mission and team values in 2-3 sentences.
4. LOGISTICS & WORK STYLE (Notice period, compensation expectations, remote/hybrid preferences, team collaboration): Give a direct, professional, and reasonable answer first, then elaborate briefly with flexibility.
5. GENERAL HR / OPINION / "WHY SHOULD WE HIRE YOU?": State your perspective clearly, highlighting your unique blend of skills, dependability, and positive attitude in 2-3 sentences.

MANDATORY RULES:
1. Answer in FIRST PERSON ("I", "my", "we") — you ARE the candidate.
2. NO bullet points, NO numbered lists, NO markdown headers. Speak naturally in conversational, spoken English.
3. NO greetings, NO filler phrases like "Great question!", "Sure!", "That's a great point". Start with the actual answer immediately.
4. NO UNNECESSARY TECHNICAL JARGON. Do not dive into deep code, complex architecture, or low-level implementation details unless the interviewer explicitly asks for them. Keep explanations accessible, emphasizing business impact, communication, problem-solving, teamwork, adaptability, and results.
5. NEVER fabricate jobs, companies, or experiences not in the resume. If the resume has real experience, use it authentically. If not, speak in terms of general professional experience ("In my previous roles...", "When collaborating with cross-functional teams...").
6. Keep answers TIGHT — 3 to 6 sentences max for most questions. Be clear, concise, and engaging without rambling. Interview time is limited.
7. For yes/no or logistical questions, answer clearly FIRST, then provide brief context.
8. STT ROBUSTNESS: Transcripts are generated by live speech-to-text and may contain slight phonetic misrecognitions or missing punctuation. Intelligently infer the interviewer's intended HR or behavioral question from conversational context and answer the true question directly without commenting on any transcript glitch.`;

      if (context) {
        const resume = context.resumeText || context.resume_text;
        if (resume) {
          prompt += `\n\nCANDIDATE'S ACTUAL BACKGROUND (use this for specific answers):\n${resume.slice(0, 2000)}`;
        }
        if (context.notes) {
          prompt += `\n\nFOCUS AREAS / EXTRA CONTEXT:\n${context.notes.slice(0, 800)}`;
        }
      }

      prompt += `\n\nRemember: Real, concise, personable, and confident. Emphasize communication, ownership, and adaptability. Answer like a poised, articulate candidate whom HR would be confident moving forward.`;
    } else {
      prompt = `You are the candidate in a live job interview for a ${experienceLevel} ${jobTitle}${company} (${interviewRound} round).
You are answering the interviewer's questions in real time. Your job is to give sharp, genuine, on-point interview answers — the kind a strong candidate gives to get hired, not textbook filler.

ANSWER FRAMEWORKS — use the right one for each question type:

1. BEHAVIORAL ("Tell me about a time...", "How did you handle..."): Use STAR — 1 sentence each for Situation, Task, Action, and Result. Keep it real and specific. Total: 4-5 sentences.
2. TECHNICAL ("How does X work?", "What is Y?", "Explain Z"): Give the direct concept in 1-2 sentences, then a real-world application or comparison in 1-2 sentences. No fluff.
3. SYSTEM DESIGN ("Design a...", "How would you architect..."): Give 2-3 clear design decisions with brief justifications. Mention trade-offs.
4. CODING PROBLEM: Briefly explain your approach in 1 sentence, then write clean minimal code.
5. INTRO / "Tell me about yourself": 3-sentence structure — who you are + what you do + what you're looking for. Confident, not a resume recitation.
6. OPINION / SITUATIONAL ("What would you do if..."): Give a direct opinion/decision first, then explain why in 1-2 sentences.

MANDATORY RULES:
1. Answer in FIRST PERSON ("I", "my", "we") — you ARE the candidate.
2. NO bullet points, NO numbered lists, NO markdown headers. Speak naturally as if talking aloud.
3. NO greetings, NO filler phrases like "Great question!", "Sure!", "That's a great point". Start with the actual answer immediately.
4. NEVER fabricate jobs, companies, or experiences not in the resume. If the resume has real experience, use it. If not, speak in general engineering terms ("In my experience..." or "When I've worked on similar problems...").
5. Keep answers TIGHT — 3 to 6 sentences max for most questions. Interview time is limited.
6. Sound confident and direct, like someone who knows their stuff. Not nervous, not over-explaining.
7. For yes/no questions, answer yes or no FIRST, then explain briefly.
8. STT ROBUSTNESS: Transcripts are generated by live speech-to-text and may contain slight phonetic misrecognitions of technical jargon (e.g., 'state' instead of 'set', 'table' instead of 'tuple', 'sink' instead of 'sync', 'py torch' instead of 'PyTorch', 'dunder' instead of '__dunder__', 'fast api' instead of 'FastAPI', 'spring boot' instead of 'Spring Boot', 's three' instead of 'S3', 'e c two' instead of 'EC2'). Intelligently infer the interviewer's intended technical question from context across all fields (Python, FastAPI, Django, Flask, Data Science, AI/ML, Data Analysis, AWS, System Design, Java, Spring Boot, Networking, SQL, DSA, HR behavioral) and answer the true concept directly without pointing out the transcript glitch.`;

      if (context) {
        const resume = context.resumeText || context.resume_text;
        if (resume) {
          prompt += `\n\nCANDIDATE'S ACTUAL BACKGROUND (use this for specific answers):\n${resume.slice(0, 2000)}`;
        }
        if (context.notes) {
          prompt += `\n\nFOCUS AREAS / EXTRA CONTEXT:\n${context.notes.slice(0, 800)}`;
        }
      }

      prompt += `\n\nRemember: Real, concise, confident. No fake experiences. No padding. Answer like a senior engineer who has done this before.`;
    }

    return prompt;
  }

  /**
   * Stream a chat completion from Groq API.
   */
  public async streamChat(
    options: ChatStreamOptions,
    onChunk: (chunk: string) => void
  ): Promise<{ fullAnswer: string; modelUsed: string }> {
    const client = this.getClient(options.apiKey);

    const targetModel = this.resolveModel(options.model);
    const systemPrompt = this.buildSystemPrompt(options.sessionContext);
    
    // Check if system prompt is already in messages, otherwise prepend
    const hasSystemMsg = options.messages.some((m) => m.role === "system");
    const fullMessages = hasSystemMsg
      ? options.messages
      : [{ role: "system" as const, content: systemPrompt }, ...options.messages];

    let stream: any;
    let modelUsed = targetModel;

    try {
      stream = await client.chat.completions.create(
        {
          model: targetModel,
          messages: fullMessages,
          max_tokens: 1024,
          temperature: 0.55,
          stream: true,
        },
        { signal: options.signal }
      );
    } catch (err: any) {
      // Fallback model handling on 404 or specific model rate limits
      if (
        (err?.status === 404 || err?.message?.includes("does not exist") || err?.status === 429) &&
        targetModel !== FALLBACK_MODEL
      ) {
        modelUsed = FALLBACK_MODEL;
        stream = await client.chat.completions.create(
          {
            model: FALLBACK_MODEL,
            messages: fullMessages,
            max_tokens: 800,
            temperature: 0.6,
            stream: true,
          },
          { signal: options.signal }
        );
      } else {
        throw err;
      }
    }

    let fullAnswer = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullAnswer += delta;
        onChunk(delta);
      }
    }

    return { fullAnswer, modelUsed };
  }

  /**
   * Stream screen / vision analysis from Groq API with 429 fallback and accurate diagnostics.
   */
  public async streamScreenAnalysis(
    options: ScreenAnalysisOptions,
    onChunk: (chunk: string) => void
  ): Promise<ScreenAnalysisResult> {
    const client = this.getClient(options.apiKey);

    const primaryModel = this.resolveVisionModel(options.model);
    const fallbackModel = primaryModel === DEFAULT_VISION_MODEL ? FALLBACK_VISION_MODEL : null;

    const questionText =
      options.question ||
      "You are an expert technical interview co-pilot assisting the candidate in real time.\n" +
      "TASK:\n" +
      "1. Identify the exact interview question, coding problem, multiple choice question (MCQ), or system design challenge visible on this screen.\n" +
      "2. DIRECT ANSWER FIRST: Provide the immediate, actionable solution, correct MCQ option, or optimal code immediately.\n" +
      "CRITICAL RULES:\n" +
      "- DO NOT describe the screenshot, IDE layout, window borders, or UI elements.\n" +
      "- DO NOT say 'In this screenshot I see...' or 'The screen displays...'.\n" +
      "- If a coding problem: give a 1-sentence approach then the optimal, complete solution code with time/space complexity.\n" +
      "- If an MCQ: state the correct option letter/text clearly and explain why in 1-2 sentences.\n" +
      "- If terminal or code error: state the exact fix immediately.\n" +
      "- If a question is highlighted or asked by an interviewer, answer that question directly.";

    const logErrorDiagnostics = (err: any, attemptedModel: string) => {
      try {
        const imageBytes = Buffer.byteLength(options.imageBase64, "base64");
        const imageMB = (imageBytes / (1024 * 1024)).toFixed(2);
        const status = err.status || err.statusCode || err.response?.status;
        const code = err.code || err.error?.code || err.type || "UNKNOWN";
        const message = err.message || err.error?.message || String(err);

        console.error("[GroqVisionDiagnostic] ========================================");
        console.error(`[GroqVisionDiagnostic] Timestamp: ${new Date().toISOString()}`);
        console.error(`[GroqVisionDiagnostic] Request ID: ${options.requestId || "none"}`);
        console.error(`[GroqVisionDiagnostic] Attempted Model: ${attemptedModel}`);
        console.error(`[GroqVisionDiagnostic] HTTP Status: ${status ?? "N/A"}`);
        console.error(`[GroqVisionDiagnostic] Error Code: ${code}`);
        console.error(`[GroqVisionDiagnostic] Error Message: ${message}`);
        console.error(`[GroqVisionDiagnostic] Image Payload: ${imageBytes} bytes (~${imageMB} MB)`);
        console.error(`[GroqVisionDiagnostic] Active Streams: ${options.activeStreamsCount ?? "N/A"}`);
        console.error("[GroqVisionDiagnostic] ========================================");
      } catch (logErr) {
        console.error("[GroqVisionDiagnostic] Failed to format diagnostic log:", logErr);
      }
    };

    const isRateLimitError = (err: any): boolean => {
      const status = err.status || err.statusCode || err.response?.status;
      const code = err.code || err.error?.code || err.type;
      const msg = (err.message || err.error?.message || "").toLowerCase();
      return (
        status === 429 ||
        code === "rate_limit_exceeded" ||
        code === "tokens" ||
        msg.includes("rate limit") ||
        msg.includes("tokens per minute") ||
        msg.includes("itpm")
      );
    };

    const extractRetrySeconds = (err: any): number => {
      try {
        const msg = err.message || err.error?.message || "";
        const match = msg.match(/try again in ([\d\.]+)\s*(ms|s|m|seconds?|minutes?)/i);
        if (match) {
          const val = parseFloat(match[1]);
          const unit = match[2].toLowerCase();
          if (unit.startsWith("ms")) return Math.max(1, Math.ceil(val / 1000));
          if (unit.startsWith("m") && !unit.startsWith("ms")) return Math.max(1, Math.ceil(val * 60));
          return Math.max(1, Math.ceil(val));
        }

        const resetHeader = err.headers?.["x-ratelimit-reset-tokens"] || err.headers?.["retry-after"];
        if (resetHeader) {
          const headerStr = String(resetHeader).trim();
          const secMatch = headerStr.match(/([\d\.]+)\s*s/i);
          if (secMatch) return Math.max(1, Math.ceil(parseFloat(secMatch[1])));
          const minMatch = headerStr.match(/(\d+)m\s*([\d\.]+)s/i);
          if (minMatch) return Math.max(1, parseInt(minMatch[1], 10) * 60 + Math.ceil(parseFloat(minMatch[2])));
          const num = parseFloat(headerStr);
          if (!isNaN(num)) return Math.max(1, Math.ceil(num));
        }
      } catch {}
      return 20; // safe default cooldown
    };

    const executeStream = async (targetModel: string): Promise<{ fullAnswer: string; modelUsed: string }> => {
      const isQwen36 = targetModel.includes("qwen3.6");
      const maxTokens = isQwen36 ? 800 : 1024;

      const streamParams: any = {
        model: targetModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: questionText },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${options.imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: maxTokens,
        stream: true,
      };

      const stream: any = await client.chat.completions.create(streamParams, {
        signal: options.signal,
      });

      let fullAnswer = "";
      let inThinkBlock = false;
      let buffer = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (!delta) continue;

        if (!isQwen36) {
          fullAnswer += delta;
          onChunk(delta);
          continue;
        }

        // For Qwen 3.6, strip internal <think> ... </think> tags
        buffer += delta;

        while (buffer.length > 0) {
          if (!inThinkBlock) {
            const thinkStart = buffer.indexOf("<think>");
            if (thinkStart !== -1) {
              if (thinkStart > 0) {
                const text = buffer.slice(0, thinkStart);
                fullAnswer += text;
                onChunk(text);
              }
              inThinkBlock = true;
              buffer = buffer.slice(thinkStart + 7);
            } else {
              let hasPartial = false;
              for (let len = Math.min(buffer.length, 6); len > 0; len--) {
                if ("<think>".startsWith(buffer.slice(-len))) {
                  const safe = buffer.slice(0, -len);
                  if (safe) {
                    fullAnswer += safe;
                    onChunk(safe);
                  }
                  buffer = buffer.slice(-len);
                  hasPartial = true;
                  break;
                }
              }
              if (!hasPartial) {
                fullAnswer += buffer;
                onChunk(buffer);
                buffer = "";
              } else {
                break;
              }
            }
          } else {
            const thinkEnd = buffer.indexOf("</think>");
            if (thinkEnd !== -1) {
              inThinkBlock = false;
              buffer = buffer.slice(thinkEnd + 8).replace(/^\s+/, "");
            } else {
              buffer = "";
            }
          }
        }
      }

      if (buffer && !inThinkBlock) {
        fullAnswer += buffer;
        onChunk(buffer);
      }

      return { fullAnswer: fullAnswer.trim(), modelUsed: targetModel };
    };

    let lastError: any = null;

    // 1. Attempt Primary Vision Model
    try {
      const primaryRes = await executeStream(primaryModel);
      if (primaryRes.fullAnswer && primaryRes.fullAnswer.length > 0) {
        return primaryRes;
      }
      console.warn(
        `[GroqVision] Primary vision model '${primaryModel}' yielded empty content. Falling back to '${fallbackModel}'...`
      );
      if (fallbackModel) {
        return await executeStream(fallbackModel);
      }
      return primaryRes;
    } catch (err: any) {
      lastError = err;
      logErrorDiagnostics(err, primaryModel);

      // 2. If 429 Rate Limit, attempt Fallback Vision Model ONCE
      if (isRateLimitError(err) && fallbackModel) {
        console.warn(
          `[GroqVision] Primary vision model '${primaryModel}' hit rate limit (429). Attempting fallback to '${fallbackModel}'...`
        );
        try {
          return await executeStream(fallbackModel);
        } catch (fallbackErr: any) {
          lastError = fallbackErr;
          logErrorDiagnostics(fallbackErr, fallbackModel);
        }
      }
    }

    // 3. Classify and handle error accurately
    const is429 = isRateLimitError(lastError);
    const retrySeconds = is429 ? extractRetrySeconds(lastError) : undefined;
    const status = lastError?.status || lastError?.statusCode || lastError?.response?.status;
    const code = lastError?.code || lastError?.error?.code || lastError?.type;
    const msg = (lastError?.message || lastError?.error?.message || "").toLowerCase();

    let errorCode = "AI_PROVIDER_ERROR";
    let notice = "*(Screen captured)* Screen analysis failed. Please try again.";

    if (is429) {
      errorCode = "RATE_LIMIT_EXCEEDED";
      notice = `*(Screen captured)* Screen analysis is temporarily rate-limited. Please try again in ~${retrySeconds} seconds.`;
    } else if (
      status === 413 ||
      msg.includes("payload too large") ||
      msg.includes("too large") ||
      msg.includes("invalid image data")
    ) {
      errorCode = "IMAGE_TOO_LARGE";
      notice = "*(Screen captured)* Screenshot payload is too large or invalid. Please try capturing again.";
    } else if (
      code === "model_decommissioned" ||
      code === "model_not_found" ||
      msg.includes("multimodal") ||
      msg.includes("does not support") ||
      msg.includes("decommissioned")
    ) {
      errorCode = "MODEL_CONFIGURATION_ERROR";
      notice = "*(Screen captured)* Screen vision model is unavailable or misconfigured. Please verify model settings.";
    } else if (status === 401 || status === 403 || code === "invalid_api_key") {
      errorCode = "AI_AUTH_ERROR";
      notice = "*(Screen captured)* Groq authentication error. Please verify your Groq API credentials.";
    } else if (
      lastError?.name === "AbortError" ||
      code === "ETIMEDOUT" ||
      status === 408 ||
      msg.includes("timeout")
    ) {
      errorCode = "AI_TIMEOUT";
      notice = "*(Screen captured)* Screen analysis timed out. Please try again.";
    } else if (status >= 500) {
      errorCode = "AI_PROVIDER_ERROR";
      notice = "*(Screen captured)* Groq service error. Please try again in a moment.";
    }

    onChunk(notice);
    return {
      fullAnswer: notice,
      modelUsed: "error-notice",
      isError: true,
      errorCode,
      retryAfterSeconds: retrySeconds,
    };
  }
}

export const groqBackendService = new GroqBackendService();
