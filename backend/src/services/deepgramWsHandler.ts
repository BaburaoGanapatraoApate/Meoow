import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer, IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { z } from "zod";
import { DeepgramLiveSession, DeepgramLiveConfig } from "./deepgramService";
import { resolveDeepgramCredential } from "./providerCredentialService";

dotenv.config();

// Limits & Configuration
export const MAX_BINARY_FRAME_SIZE = 64 * 1024; // 64 KB max audio chunk
export const MAX_USER_WS_SESSIONS = 2; // Max 2 active sessions per authenticated user
export const MAX_GLOBAL_WS_SESSIONS = 100; // Max 100 total concurrent sessions per backend instance
export const AUTH_TIMEOUT_MS = 5000; // 5 seconds auth timeout

// In-memory session tracking (instance-local)
const activeUserWsSessions = new Map<string, number>();
let activeGlobalWsSessions = 0;

// In-memory connection rate limiter per IP (max 15 connections / minute)
const connectionAttemptsPerIp = new Map<string, number[]>();

function checkConnectionRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = (connectionAttemptsPerIp.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= 15) {
    return false;
  }
  timestamps.push(now);
  connectionAttemptsPerIp.set(ip, timestamps);
  return true;
}

const authHandshakeSchema = z.object({
  type: z.literal("auth"),
  token: z.string().min(10, "Token too short").max(2048, "Token too long"),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Invalid language code format").optional().default("en")
});

export function setupDeepgramWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket, head) => {
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";

    if (pathname === "/ws/deepgram" || pathname === "/api/deepgram/stream") {
      const clientIp = (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";

      if (!checkConnectionRateLimit(clientIp)) {
        socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }

      if (activeGlobalWsSessions >= MAX_GLOBAL_WS_SESSIONS) {
        socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (clientWs: WebSocket) => {
    activeGlobalWsSessions++;
    let isAuthenticated = false;
    let userId: string | null = null;
    let deepgramSession: DeepgramLiveSession | null = null;
    let authTimeout: NodeJS.Timeout | null = null;
    let hasCleanedUp = false;

    // Strict 5-second authentication timeout
    authTimeout = setTimeout(() => {
      if (!isAuthenticated) {
        try {
          clientWs.send(
            JSON.stringify({
              type: "error",
              code: "UNAUTHORIZED",
              message: "Authentication timeout. Connection closed.",
            })
          );
          clientWs.close(4401, "Authentication timeout");
        } catch {}
      }
    }, AUTH_TIMEOUT_MS);

    const cleanup = () => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;

      activeGlobalWsSessions = Math.max(0, activeGlobalWsSessions - 1);

      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = null;
      }

      if (userId) {
        const count = (activeUserWsSessions.get(userId) || 1) - 1;
        if (count <= 0) {
          activeUserWsSessions.delete(userId);
        } else {
          activeUserWsSessions.set(userId, count);
        }
      }

      if (deepgramSession) {
        deepgramSession.close();
        deepgramSession = null;
      }
    };

    clientWs.on("message", async (data: any, isBinary: boolean) => {
      // 1. Binary frames: Raw audio stream forwarding
      if (isBinary) {
        if (!isAuthenticated || !deepgramSession) {
          return;
        }

        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

        // Enforce maximum binary frame size to prevent memory exhaustion
        if (buffer.length > MAX_BINARY_FRAME_SIZE) {
          try {
            clientWs.send(
              JSON.stringify({
                type: "error",
                code: "PAYLOAD_TOO_LARGE",
                message: "Audio frame exceeded maximum allowed size (64KB).",
              })
            );
            clientWs.close(4413, "Payload too large");
          } catch {}
          cleanup();
          return;
        }

        if (buffer.length > 0) {
          deepgramSession.sendAudio(buffer);
        }
        return;
      }

      // 2. Text frames: JSON control messages
      try {
        const text = data.toString("utf8");
        if (text.length > 4096) {
          clientWs.send(
            JSON.stringify({
              type: "error",
              code: "PAYLOAD_TOO_LARGE",
              message: "Control message payload too large.",
            })
          );
          clientWs.close(4413, "Payload too large");
          cleanup();
          return;
        }

        const rawMsg = JSON.parse(text);

        // Authentication message
        if (rawMsg.type === "auth") {
          if (isAuthenticated) return;

          const parseResult = authHandshakeSchema.safeParse(rawMsg);
          if (!parseResult.success) {
            clientWs.send(
              JSON.stringify({
                type: "error",
                code: "UNAUTHORIZED",
                message: "Invalid authentication payload structure.",
              })
            );
            clientWs.close(4401, "Invalid auth payload");
            cleanup();
            return;
          }

          const { token, language } = parseResult.data;
          const secret = process.env.JWT_SECRET;

          if (!secret) {
            clientWs.send(
              JSON.stringify({
                type: "error",
                code: "INTERNAL_ERROR",
                message: "Server configuration error.",
              })
            );
            clientWs.close(1011, "Server configuration error");
            cleanup();
            return;
          }

          try {
            const payload = jwt.verify(token, secret, {
              algorithms: ["HS256"]
            }) as jwt.JwtPayload;

            if (
              !payload ||
              typeof payload.sub !== "string" ||
              !payload.sub ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)
            ) {
              throw new Error("Invalid token subject.");
            }

            const authenticatedUserId = payload.sub;

            // Check per-user session concurrency
            const userActiveSessions = activeUserWsSessions.get(authenticatedUserId) || 0;
            if (userActiveSessions >= MAX_USER_WS_SESSIONS) {
              clientWs.send(
                JSON.stringify({
                  type: "error",
                  code: "SESSION_LIMIT_EXCEEDED",
                  message: "Maximum active Deepgram transcription sessions reached for this account.",
                })
              );
              clientWs.close(4429, "Session limit reached");
              cleanup();
              return;
            }

            userId = authenticatedUserId;
            activeUserWsSessions.set(userId, userActiveSessions + 1);
            isAuthenticated = true;

            if (authTimeout) {
              clearTimeout(authTimeout);
              authTimeout = null;
            }

            // Resolve user-specific Deepgram API key (override or environment default)
            const deepgramApiKey = await resolveDeepgramCredential(authenticatedUserId);

            // Configure and initialize Deepgram live session
            const dgConfig: DeepgramLiveConfig = {
              language,
            };

            deepgramSession = new DeepgramLiveSession(
              dgConfig,
              {
                onMessage: (dgMsg) => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify(dgMsg));
                  }
                },
                onOpen: () => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: "ready",
                        userId,
                      })
                    );
                  }
                },
                onClose: (code, reason) => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: "closed",
                        code,
                        reason,
                      })
                    );
                  }
                },
                onError: (_err) => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: "error",
                        code: "TRANSCRIPTION_PROVIDER_ERROR",
                        message: "Deepgram transcription error occurred.",
                      })
                    );
                  }
                },
              },
              deepgramApiKey
            );

            await deepgramSession.connect();
          } catch (err: any) {
            clientWs.send(
              JSON.stringify({
                type: "error",
                code: "UNAUTHORIZED",
                message: "Invalid or expired authentication token.",
              })
            );
            clientWs.close(4401, "Invalid token");
            cleanup();
          }
          return;
        }

        // Control messages (Finalize / KeepAlive)
        if (!isAuthenticated || !deepgramSession) return;

        if (rawMsg.type === "Finalize") {
          deepgramSession.sendFinalize();
        } else if (rawMsg.type === "KeepAlive") {
          deepgramSession.sendKeepAlive();
        }
      } catch (e: any) {
        // Ignore unparseable frames safely
      }
    });

    clientWs.on("close", () => {
      cleanup();
    });

    clientWs.on("error", (_err) => {
      cleanup();
    });
  });

  return wss;
}

