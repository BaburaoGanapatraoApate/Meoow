import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

export interface DeepgramLiveConfig {
  model?: string;
  language?: string;
  smart_format?: boolean;
  interim_results?: boolean;
  endpointing?: number;
  vad_events?: boolean;
  multichannel?: boolean;
  channels?: number;
  utterance_end_ms?: number;
}

export const DEFAULT_DEEPGRAM_CONFIG: Required<DeepgramLiveConfig> = {
  model: "nova-3",
  language: "en",
  smart_format: true,
  interim_results: true,
  endpointing: 300,
  vad_events: true,
  multichannel: true,
  channels: 2,
  utterance_end_ms: 1000,
};

export interface DeepgramServiceCallbacks {
  onMessage: (message: any) => void;
  onOpen: () => void;
  onClose: (code: number, reason: string) => void;
  onError: (error: Error) => void;
}

export class DeepgramLiveSession {
  private ws: WebSocket | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private config: Required<DeepgramLiveConfig>;
  private callbacks: DeepgramServiceCallbacks;
  private isClosed = false;
  private apiKey: string;

  constructor(
    customConfig: DeepgramLiveConfig,
    callbacks: DeepgramServiceCallbacks,
    apiKeyOverride?: string
  ) {
    this.config = {
      ...DEFAULT_DEEPGRAM_CONFIG,
      ...customConfig,
    };
    this.callbacks = callbacks;
    this.apiKey = apiKeyOverride || process.env.DEEPGRAM_API_KEY || "";
  }

  private buildUrl(): string {
    const params = new URLSearchParams({
      model: this.config.model,
      language: this.config.language,
      smart_format: String(this.config.smart_format),
      interim_results: String(this.config.interim_results),
      endpointing: String(this.config.endpointing),
      vad_events: String(this.config.vad_events),
      utterance_end_ms: String(this.config.utterance_end_ms),
    });

    if (this.config.multichannel && this.config.channels > 1) {
      params.set("multichannel", "true");
      params.set("channels", String(this.config.channels));
    }

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const apiKey = this.apiKey || process.env.DEEPGRAM_API_KEY;
      if (!apiKey) {
        const err = new Error("DEEPGRAM_API_KEY is not configured in backend environment.");
        this.callbacks.onError(err);
        return reject(err);
      }

      try {
        const url = this.buildUrl();
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Token ${apiKey}`,
          },
        });

        this.ws.on("open", () => {
          this.startKeepAlive();
          this.callbacks.onOpen();
          resolve();
        });

        this.ws.on("message", (data: any) => {
          try {
            const parsed = JSON.parse(data.toString());
            this.callbacks.onMessage(parsed);
          } catch (e: any) {
            console.error("[DeepgramService] Error parsing message from Deepgram:", e);
          }
        });

        this.ws.on("close", (code: number, reason: Buffer) => {
          this.stopKeepAlive();
          this.callbacks.onClose(code, reason.toString());
        });

        this.ws.on("error", (err: Error) => {
          this.callbacks.onError(err);
          if (!this.isClosed) {
            reject(err);
          }
        });
      } catch (err: any) {
        this.callbacks.onError(err);
        reject(err);
      }
    });
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, 3000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  public sendAudio(chunk: Buffer | ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  public sendFinalize(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "Finalize" }));
    }
  }

  public sendKeepAlive(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "KeepAlive" }));
    }
  }

  public close(): void {
    this.isClosed = true;
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.removeAllListeners();
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        try {
          this.ws.close();
        } catch {
          // ignore
        }
      }
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
