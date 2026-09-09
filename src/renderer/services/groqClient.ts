import { v4 as uuidv4 } from 'uuid';
import type {
  SessionContext,
  Answer,
  TaskClassificationResult,
  BoundedContextPayload,
} from '../types';
import { stitchAnswerContinuation } from '../utils/continuationStitcher';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.meooow.tech').replace(/\/+$/, '');

export interface GroqClientCallbacks {
  onAnswerStart: (event: { source: string; requestId: string }) => void;
  onAnswerChunk: (event: { chunk: string; requestId: string }) => void;
  onAnswer: (answer: Answer) => void;
  onError: (error: { message: string; category?: string; code?: string; event?: string; requestId?: string }) => void;
}

interface RequestRecord {
  source: string;
  originalQuestion: string;
  payload: any;
  accumulatedAnswer: string;
  hasContinued: boolean;
}

export class GroqClient {
  private callbacks: GroqClientCallbacks;
  private sessionContext: SessionContext;
  private activeControllers = new Map<string, AbortController>();
  private requestRecords = new Map<string, RequestRecord>();
  private continuedRequests = new Set<string>();
  private parentToContinuationMap = new Map<string, string>();
  private disconnected = false;

  constructor(callbacks: GroqClientCallbacks, sessionContext: SessionContext) {
    this.callbacks = callbacks;
    this.sessionContext = sessionContext;
  }

  private async fetchStream(
    requestId: string,
    payload: any,
    source: string
  ): Promise<void> {
    if (this.disconnected) return;

    const controller = new AbortController();
    this.activeControllers.set(requestId, controller);

    try {
      this.callbacks.onAnswerStart({ source, requestId });

      const token = await window.meow?.getAuthToken?.();
      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }

      const deviceIdentity = await window.meow?.getDeviceIdentity?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      if (deviceIdentity?.deviceId && deviceIdentity?.deviceToken) {
        headers['X-Device-Id'] = deviceIdentity.deviceId;
        headers['X-Device-Token'] = deviceIdentity.deviceToken;
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/groq/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestId,
          source,
          ...payload,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errData: any = {};
        try {
          errData = await response.json();
        } catch {
          errData = { message: `Request failed with status ${response.status}` };
        }

        const errorMessage = errData.message || errData.error || 'AI generation failed.';
        this.callbacks.onError({
          message: errorMessage,
          code: errData.error || (response.status === 402 ? 'INSUFFICIENT_CREDITS' : undefined),
          requestId,
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response body is unavailable.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedAnswer = '';
      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;

        const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
        if (!jsonStr) return;

        try {
          const data = JSON.parse(jsonStr);

          if (data.type === 'chunk') {
            const text = data.text ?? data.chunk ?? data.content ?? '';
            accumulatedAnswer += text;
            const record = this.requestRecords.get(requestId);
            if (record) {
              record.accumulatedAnswer = accumulatedAnswer;
            }
            this.callbacks.onAnswerChunk({
              chunk: text,
              requestId,
            });
          } else if (data.type === 'done') {
            const finishReason = data.finishReason || (data.isError ? 'error' : 'stop');
            const isLengthTruncated = finishReason === 'length' && !data.isError;
            const record = this.requestRecords.get(requestId);
            const alreadyContinued = this.continuedRequests.has(requestId) || (record?.hasContinued ?? false);

            if (isLengthTruncated && !alreadyContinued && record) {
              this.continuedRequests.add(requestId);
              record.hasContinued = true;
              record.accumulatedAnswer = accumulatedAnswer;

              // Perform single controlled continuation
              this.triggerContinuation(requestId, source, accumulatedAnswer, record);
              return;
            }

            this.requestRecords.delete(requestId);
            this.callbacks.onAnswer({
              answer: data.answer || accumulatedAnswer,
              timestamp: data.timestamp || new Date().toISOString(),
              source: data.source || source,
              requestId,
              isError: data.isError,
              errorCode: data.errorCode,
              retryAfterSeconds: data.retryAfterSeconds,
            });
          } else if (data.type === 'error') {
            this.requestRecords.delete(requestId);
            this.callbacks.onError({
              message: data.error || 'AI generation error',
              code: data.code,
              requestId,
            });
          }
        } catch (jsonErr) {
          console.warn('[GroqClient] Error parsing SSE JSON chunk:', jsonErr);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      }

      // Flush residual decoder buffer and check remaining lines
      const finalChunk = decoder.decode();
      if (finalChunk) {
        buffer += finalChunk;
      }
      if (buffer.trim()) {
        const remainingLines = buffer.split('\n');
        for (const line of remainingLines) {
          processLine(line);
        }
        buffer = '';
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && !this.disconnected) {
        this.callbacks.onError({
          message: err.message || 'AI request failed.',
          requestId,
        });
      }
    } finally {
      this.activeControllers.delete(requestId);
    }
  }

  private async triggerContinuation(
    parentRequestId: string,
    source: string,
    previousAnswer: string,
    record: RequestRecord
  ): Promise<void> {
    if (this.disconnected) return;

    const continuationRequestId = `cont_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const controller = new AbortController();
    this.activeControllers.set(continuationRequestId, controller);
    this.parentToContinuationMap.set(parentRequestId, continuationRequestId);

    try {
      const token = await window.meow?.getAuthToken?.();
      if (!token) throw new Error('Authentication required.');

      const deviceIdentity = await window.meow?.getDeviceIdentity?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (deviceIdentity?.deviceId && deviceIdentity?.deviceToken) {
        headers['X-Device-Id'] = deviceIdentity.deviceId;
        headers['X-Device-Token'] = deviceIdentity.deviceToken;
      }

      const originalMessages = record.payload.messages || [
        { role: 'user', content: record.originalQuestion }
      ];

      const continuationPrompt =
        'Continue exactly from where the previous answer stopped. Do not repeat previous content. Complete the unfinished sentence, section, or code block. Return only the continuation.';

      const continuationPayload = {
        ...record.payload,
        isContinuation: true,
        parentRequestId,
        previousAnswer,
        requestId: continuationRequestId,
        messages: [
          ...originalMessages,
          { role: 'assistant', content: previousAnswer },
          { role: 'user', content: continuationPrompt },
        ],
      };

      const response = await fetch(`${API_BASE_URL}/api/ai/groq/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestId: continuationRequestId,
          source,
          ...continuationPayload,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[GroqClient] Continuation HTTP ${response.status}. Finalizing with previous answer.`);
        this.requestRecords.delete(parentRequestId);
        this.parentToContinuationMap.delete(parentRequestId);
        this.callbacks.onAnswer({
          answer: previousAnswer,
          timestamp: new Date().toISOString(),
          source,
          requestId: parentRequestId,
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Continuation stream unavailable.');

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let continuationAnswer = '';

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;
        const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
        if (!jsonStr) return;

        try {
          const data = JSON.parse(jsonStr);
          if (data.type === 'chunk') {
            const text = data.text ?? data.chunk ?? data.content ?? '';
            continuationAnswer += text;
            this.callbacks.onAnswerChunk({
              chunk: text,
              requestId: parentRequestId,
            });
          } else if (data.type === 'done') {
            const stitched = stitchAnswerContinuation(previousAnswer, continuationAnswer || data.answer || '');
            this.requestRecords.delete(parentRequestId);
            this.parentToContinuationMap.delete(parentRequestId);
            this.callbacks.onAnswer({
              answer: stitched,
              timestamp: data.timestamp || new Date().toISOString(),
              source: data.source || source,
              requestId: parentRequestId,
              isError: data.isError,
              errorCode: data.errorCode,
              retryAfterSeconds: data.retryAfterSeconds,
            });
          } else if (data.type === 'error') {
            this.requestRecords.delete(parentRequestId);
            this.parentToContinuationMap.delete(parentRequestId);
            this.callbacks.onAnswer({
              answer: previousAnswer,
              timestamp: new Date().toISOString(),
              source,
              requestId: parentRequestId,
            });
          }
        } catch (jsonErr) {
          console.warn('[GroqClient] Error parsing continuation SSE chunk:', jsonErr);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      }

      const finalChunk = decoder.decode();
      if (finalChunk) buffer += finalChunk;
      if (buffer.trim()) {
        const remainingLines = buffer.split('\n');
        for (const line of remainingLines) {
          processLine(line);
        }
        buffer = '';
      }

    } catch (err: any) {
      if (err.name !== 'AbortError' && !this.disconnected) {
        console.warn('[GroqClient] Continuation error:', err);
        this.requestRecords.delete(parentRequestId);
        this.parentToContinuationMap.delete(parentRequestId);
        this.callbacks.onAnswer({
          answer: previousAnswer,
          timestamp: new Date().toISOString(),
          source,
          requestId: parentRequestId,
        });
      }
    } finally {
      this.activeControllers.delete(continuationRequestId);
      this.parentToContinuationMap.delete(parentRequestId);
    }
  }

  /** Send transcript for AI answer generation */
  sendTranscript(
    context: string,
    _autoTriggered: boolean,
    source: string,
    language: string,
    taskClassification?: TaskClassificationResult,
    boundedContext?: BoundedContextPayload
  ): string | null {
    if (this.disconnected || !context.trim()) return null;

    const requestId = uuidv4();
    const payload = {
      messages: [
        {
          role: 'user',
          content: context,
        },
      ],
      model: this.sessionContext.streamingModel,
      taskType: taskClassification?.taskType,
      parentTaskType: taskClassification?.parentTaskType,
      taskConfidence: taskClassification?.confidence,
      taskTier: taskClassification?.tier,
      suggestedDepth: taskClassification?.suggestedDepth,
      requiresCode: taskClassification?.requiresCode,
      boundedContext,
      sessionContext: {
        ...this.sessionContext,
        language,
        taskType: taskClassification?.taskType,
        parentTaskType: taskClassification?.parentTaskType,
        taskConfidence: taskClassification?.confidence,
        taskTier: taskClassification?.tier,
        suggestedDepth: taskClassification?.suggestedDepth,
        requiresCode: taskClassification?.requiresCode,
        boundedContext,
      },
    };

    this.requestRecords.set(requestId, {
      source,
      originalQuestion: context,
      payload,
      accumulatedAnswer: '',
      hasContinued: false,
    });

    this.fetchStream(requestId, payload, source);
    return requestId;
  }

  /** Send a manual question */
  sendManualQuestion(
    question: string,
    language: string,
    taskClassification?: TaskClassificationResult,
    boundedContext?: BoundedContextPayload
  ): string | null {
    if (this.disconnected || !question.trim()) return null;

    const requestId = uuidv4();
    const payload = {
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
      model: this.sessionContext.streamingModel,
      taskType: taskClassification?.taskType,
      parentTaskType: taskClassification?.parentTaskType,
      taskConfidence: taskClassification?.confidence,
      taskTier: taskClassification?.tier,
      suggestedDepth: taskClassification?.suggestedDepth,
      requiresCode: taskClassification?.requiresCode,
      boundedContext,
      sessionContext: {
        ...this.sessionContext,
        language,
        taskType: taskClassification?.taskType,
        parentTaskType: taskClassification?.parentTaskType,
        taskConfidence: taskClassification?.confidence,
        taskTier: taskClassification?.tier,
        suggestedDepth: taskClassification?.suggestedDepth,
        requiresCode: taskClassification?.requiresCode,
        boundedContext,
      },
    };

    this.requestRecords.set(requestId, {
      source: 'manual',
      originalQuestion: question,
      payload,
      accumulatedAnswer: '',
      hasContinued: false,
    });

    this.fetchStream(requestId, payload, 'manual');
    return requestId;
  }

  /** Send screen capture for analysis */
  async sendScreenCapture(blob: Blob): Promise<string | null> {
    if (this.disconnected) return null;

    const requestId = uuidv4();

    // Convert blob to base64 cleanly
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const commaIdx = result.indexOf(',');
        resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error('Failed to read screenshot image'));
      reader.readAsDataURL(blob);
    });

    const payload = {
      imageBase64: base64,
      question:
        'You are an expert technical interview co-pilot assisting the candidate in real time.\n' +
        'TASK:\n' +
        '1. Identify the exact interview question, coding problem, multiple choice question (MCQ), or system design challenge visible on this screen.\n' +
        '2. DIRECT ANSWER FIRST: Provide the immediate, actionable solution, correct MCQ option, or optimal code immediately.\n' +
        'CRITICAL RULES:\n' +
        '- DO NOT describe the screenshot, IDE layout, window borders, or UI elements.\n' +
        '- DO NOT say "In this screenshot I see..." or "The screen displays...".\n' +
        '- If a coding problem: give a 1-sentence approach then the optimal, complete solution code with time/space complexity.\n' +
        '- If an MCQ: state the correct option letter/text clearly and explain why in 1-2 sentences.\n' +
        '- If terminal or code error: state the exact fix immediately.\n' +
        '- If a question is highlighted or asked by an interviewer, answer that question directly.',
      model: this.sessionContext.visionModel || 'qwen/qwen3.6-27b',
      sessionContext: this.sessionContext,
    };

    this.requestRecords.set(requestId, {
      source: 'screen',
      originalQuestion: payload.question,
      payload,
      accumulatedAnswer: '',
      hasContinued: false,
    });

    this.fetchStream(requestId, payload, 'screen');
    return requestId;
  }

  /** Report an error (local logging only) */
  reportError(category: string, code: string): void {
    console.error(`[Meow] Error: ${category} - ${code}`);
  }

  /** Reconnect (no-op for HTTP, but kept for interface compatibility) */
  reconnect(): void {
    // HTTP per-request connection
  }

  /** Cancel a specific stream */
  cancelStream(requestId: string): void {
    const controller = this.activeControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(requestId);
    }
    const contId = this.parentToContinuationMap.get(requestId);
    if (contId) {
      const contController = this.activeControllers.get(contId);
      if (contController) {
        contController.abort();
        this.activeControllers.delete(contId);
      }
      this.parentToContinuationMap.delete(requestId);
    }
    this.requestRecords.delete(requestId);
  }

  /** Cancel all pending streams and clean up */
  disconnect(): void {
    this.disconnected = true;
    for (const [, controller] of this.activeControllers) {
      controller.abort();
    }
    this.activeControllers.clear();
    this.requestRecords.clear();
    this.parentToContinuationMap.clear();
    this.continuedRequests.clear();
  }
}
