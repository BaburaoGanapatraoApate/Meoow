import { v4 as uuidv4 } from 'uuid';
import type {
  SessionContext,
  Answer,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

export interface GroqClientCallbacks {
  onAnswerStart: (event: { source: string; requestId: string }) => void;
  onAnswerChunk: (event: { chunk: string; requestId: string }) => void;
  onAnswer: (answer: Answer) => void;
  onError: (error: { message: string; category?: string; code?: string; event?: string; requestId?: string }) => void;
}

export class GroqClient {
  private callbacks: GroqClientCallbacks;
  private sessionContext: SessionContext;
  private activeControllers = new Map<string, AbortController>();
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'chunk') {
              const text = data.text ?? data.chunk ?? data.content ?? '';
              accumulatedAnswer += text;
              this.callbacks.onAnswerChunk({
                chunk: text,
                requestId,
              });
            } else if (data.type === 'done') {
              this.callbacks.onAnswer({
                answer: data.answer || accumulatedAnswer,
                timestamp: data.timestamp || new Date().toISOString(),
                source: data.source || source,
                requestId,
              });
            } else if (data.type === 'error') {
              this.callbacks.onError({
                message: data.error || 'AI generation error',
                code: data.code,
                requestId,
              });
            }
          } catch (jsonErr) {
            console.warn('[GroqClient] Error parsing SSE JSON chunk:', jsonErr);
          }
        }
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

  /** Send transcript for AI answer generation */
  sendTranscript(
    context: string,
    _autoTriggered: boolean,
    source: string,
    language: string
  ): boolean {
    if (this.disconnected || !context.trim()) return false;

    const requestId = uuidv4();
    const payload = {
      messages: [
        {
          role: 'user',
          content: context,
        },
      ],
      model: this.sessionContext.streamingModel,
      sessionContext: {
        ...this.sessionContext,
        language,
      },
    };

    this.fetchStream(requestId, payload, source);
    return true;
  }

  /** Send a manual question */
  sendManualQuestion(question: string, language: string): boolean {
    if (this.disconnected || !question.trim()) return false;

    const requestId = uuidv4();
    const payload = {
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
      model: this.sessionContext.streamingModel,
      sessionContext: {
        ...this.sessionContext,
        language,
      },
    };

    this.fetchStream(requestId, payload, 'manual');
    return true;
  }

  /** Send screen capture for analysis */
  async sendScreenCapture(blob: Blob): Promise<string | null> {
    if (this.disconnected) return null;

    const requestId = uuidv4();

    // Convert blob to base64
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const payload = {
      imageBase64: base64,
      question: 'Analyze this screen and provide relevant interview assistance based on what you see.',
      model: this.sessionContext.streamingModel,
      sessionContext: this.sessionContext,
    };

    this.fetchStream(requestId, payload, 'screen_capture');
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
  }

  /** Cancel all pending streams and clean up */
  disconnect(): void {
    this.disconnected = true;
    for (const [, controller] of this.activeControllers) {
      controller.abort();
    }
    this.activeControllers.clear();
  }
}
