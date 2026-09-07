/**
 * Deepgram WebSocket client for real-time speech-to-text.
 * Connects securely to the Meoow backend WebSocket gateway at /ws/deepgram.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

export interface DeepgramConfig {
  model?: string;
  language: string;
  smart_format?: boolean;
  interim_results?: boolean;
  endpointing?: number;
  vad_events?: boolean;
  multichannel?: boolean;
  channels?: number;
}

export const DEFAULT_DEEPGRAM_CONFIG: DeepgramConfig = {
  model: 'nova-3',
  language: 'en',
  smart_format: true,
  interim_results: true,
  endpointing: 300,
  vad_events: true,
  multichannel: true,
  channels: 2,
};

const MAX_RECONNECT_ATTEMPTS = 999;
const STABLE_CONNECTION_MS = 10_000;
const KEEPALIVE_INTERVAL_MS = 2_000;

export type DeepgramEventHandler = (event: DeepgramMessageEvent) => void;

export interface DeepgramMessageEvent {
  type: string;
  channel_index?: number[];
  channel?: {
    alternatives: Array<{ transcript: string }>;
  };
  is_final?: boolean;
  speech_final?: boolean;
  from_finalize?: boolean;
}

export interface DeepgramConnectionManager {
  socket: WebSocket | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMedia: (data: Blob | ArrayBuffer) => void;
  sendFinalize: () => void;
  sendKeepAlive: () => void;
  isConnected: () => boolean;
}

/**
 * Create an authenticated connection to the Meoow Deepgram WebSocket gateway.
 */
export function createDeepgramConnection(
  getAuthToken: () => Promise<string | null | undefined>,
  language: string,
  onMessage: (event: DeepgramMessageEvent) => void,
  onOpen: () => void,
  onClose: (code?: number) => void,
  onError: (error: Event | Error) => void
): DeepgramConnectionManager {
  let ws: WebSocket | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let isReady = false;

  const startKeepAlive = () => {
    stopKeepAlive();
    keepAliveTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN && isReady) {
        ws.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, KEEPALIVE_INTERVAL_MS);
  };

  const stopKeepAlive = () => {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  };

  const connect = (): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await getAuthToken();
        if (!token) {
          const err = new Error('No authentication token available.');
          onError(err);
          return reject(err);
        }

        const wsUrl = `${WS_BASE_URL}/ws/deepgram`;
        ws = new WebSocket(wsUrl);

        ws.onopen = async () => {
          const deviceIdentity = await window.meow?.getDeviceIdentity?.();
          // Send initial authentication & configuration payload
          ws?.send(
            JSON.stringify({
              type: 'auth',
              token,
              language: language || 'en',
              deviceId: deviceIdentity?.deviceId,
              deviceToken: deviceIdentity?.deviceToken,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'ready') {
              isReady = true;
              startKeepAlive();
              onOpen();
              resolve();
              return;
            }

            if (data.type === 'error') {
              onError(new Error(data.message || 'Deepgram transcription error'));
              return;
            }

            // Normal transcription events
            onMessage(data);
          } catch (e) {
            console.error('[DeepgramClient] Failed to parse message:', e);
          }
        };

        ws.onclose = (event) => {
          isReady = false;
          stopKeepAlive();
          onClose(event.code);
        };

        ws.onerror = (event) => {
          isReady = false;
          onError(event);
          reject(event);
        };
      } catch (e) {
        reject(e);
      }
    });
  };

  const disconnect = () => {
    isReady = false;
    stopKeepAlive();
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ws = null;
    }
  };

  const sendMedia = async (data: Blob | ArrayBuffer) => {
    if (ws?.readyState === WebSocket.OPEN && isReady) {
      if (data instanceof Blob) {
        try {
          const buffer = await data.arrayBuffer();
          if (ws?.readyState === WebSocket.OPEN && buffer.byteLength > 0) {
            ws.send(buffer);
          }
        } catch (_) {}
      } else if (data.byteLength > 0) {
        ws.send(data);
      }
    }
  };

  const sendFinalize = () => {
    if (ws?.readyState === WebSocket.OPEN && isReady) {
      ws.send(JSON.stringify({ type: 'Finalize' }));
    }
  };

  const sendKeepAlive = () => {
    if (ws?.readyState === WebSocket.OPEN && isReady) {
      ws.send(JSON.stringify({ type: 'KeepAlive' }));
    }
  };

  const isConnected = () => ws?.readyState === WebSocket.OPEN && isReady;

  return {
    get socket() {
      return ws;
    },
    connect,
    disconnect,
    sendMedia,
    sendFinalize,
    sendKeepAlive,
    isConnected,
  };
}

/**
 * Manages the full Deepgram lifecycle with reconnection through backend gateway.
 */
export interface DeepgramManager {
  connection: DeepgramConnectionManager | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function createDeepgramManager(
  getAuthToken: () => Promise<string | null | undefined>,
  language: string,
  onMessage: (event: DeepgramMessageEvent) => void,
  onConnectionStateChange: (state: 'connecting' | 'connected' | 'reconnecting' | 'error') => void
): DeepgramManager {
  let connection: DeepgramConnectionManager | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stableTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (stableTimer) {
      clearTimeout(stableTimer);
      stableTimer = null;
    }
  };

  const scheduleReconnect = (reason: string) => {
    if (stopped || reconnectTimer) return;

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.min(reconnectAttempts, 3), 3000);
    onConnectionStateChange('reconnecting');
    console.log(`[Deepgram] Reconnect scheduled in ${delay}ms (${reason})`);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!stopped) doConnect(true);
    }, delay);
  };

  const doConnect = async (isReconnect = false): Promise<void> => {
    if (stopped) return;

    const token = await getAuthToken();
    if (!token) {
      console.error('[Deepgram] No authentication token available');
      onConnectionStateChange('error');
      return;
    }

    if (isReconnect) onConnectionStateChange('reconnecting');
    else onConnectionStateChange('connecting');

    connection = createDeepgramConnection(
      getAuthToken,
      language,
      onMessage,
      () => {
        // onOpen / ready
        if (stopped) {
          connection?.disconnect();
          return;
        }
        onConnectionStateChange('connected');

        // Reset reconnect after stable period
        if (stableTimer) clearTimeout(stableTimer);
        stableTimer = setTimeout(() => {
          stableTimer = null;
          if (reconnectAttempts > 0) {
            console.log('[Deepgram] Connection stable, resetting reconnect counter');
            reconnectAttempts = 0;
          }
        }, STABLE_CONNECTION_MS);
      },
      (code) => {
        // onClose
        if (stopped) return;
        if (stableTimer) {
          clearTimeout(stableTimer);
          stableTimer = null;
        }
        scheduleReconnect(`socket closed (code: ${code})`);
      },
      () => {
        // onError
        if (stopped) return;
        scheduleReconnect('socket error');
      }
    );

    try {
      await connection.connect();
    } catch (e) {
      console.error('[Deepgram] Connection failed:', e);
      if (!stopped) scheduleReconnect('connection failed');
    }
  };

  return {
    get connection() {
      return connection;
    },
    start: () => {
      stopped = false;
      reconnectAttempts = 0;
      return doConnect(false);
    },
    stop: () => {
      stopped = true;
      clearTimers();
      connection?.disconnect();
      connection = null;
    },
  };
}
