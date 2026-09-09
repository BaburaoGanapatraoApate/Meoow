import http from "http";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { checkDatabaseConnection } from "./db/checkDatabase";
import { runMigrations } from "./db/migrate";
import authRouter from "./routes/auth";
import creditsRouter from "./routes/credits";
import aiRouter from "./routes/ai";
import paymentsRouter from "./routes/payments";
import adminRouter from "./routes/admin";
import devicesRouter from "./routes/devices";
import { apiLimiter } from "./middleware/rateLimiter";
import { setupDeepgramWebSocketServer } from "./services/deepgramWsHandler";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";

// 1. Trust Proxy configuration for Render / Reverse Proxies
app.set("trust proxy", 1);

// 2. Global HTTP Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false, // APIs return JSON/SSE/WS; CSP is managed on frontend/electron
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "deny" },
    xContentTypeOptions: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// 3. CORS Hardening
const parseWebOrigins = (originEnv?: string): string[] => {
  if (!originEnv) return [];
  return originEnv.split(",").map((s) => s.trim()).filter(Boolean);
};

const allowedOrigins = [
  ...parseWebOrigins(process.env.WEB_ORIGIN),
  "https://meooow.tech",
  "https://www.meooow.tech",
  "https://meoow.tech",
  "https://www.meoow.tech",
  ...(!isProduction
    ? [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4000",
      ]
    : []),
  "file://",
  "vscode-file://",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4000",
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (Electron desktop background fetch, curl, server-to-server)
      // and packaged Electron renderer fetch requests where Origin is "null", "file://", etc.
      if (!origin || origin === "null" || origin === "file://" || origin.startsWith("vscode-file://")) {
        return callback(null, true);
      }

      // Check explicit allowlist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow localhost/127.0.0.1 on any port for desktop co-pilot / local testing
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Reject unauthorized origins
      const corsErr: any = new Error("Not allowed by CORS");
      corsErr.status = 403;
      corsErr.code = "CORS_FORBIDDEN";
      return callback(corsErr, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Device-Id",
      "X-Device-Token",
      "x-device-id",
      "x-device-token",
    ],
    credentials: false,
  })
);

// 4. Request Body Parsers with Controlled Limits & Raw Body Capture for Webhooks
app.use(
  express.json({
    limit: "2mb",
    verify: (req: any, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// 5. Global API Rate Limiter (120 req/min) for general abuse protection
app.use("/api/", apiLimiter);

// 6. Health Check Endpoint (Lightweight & Unauthenticated)
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "Meoow API",
  });
});

// 7. Route Handlers
app.use("/api/auth", authRouter);
app.use("/api/credits", creditsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/devices", devicesRouter);

// 8. 404 Catch-All Handler for Unmatched Routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Requested endpoint does not exist.",
  });
});

// 9. Centralized Error Sanitization Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Handle JSON Syntax Errors (Malformed Request Body)
  if (err instanceof SyntaxError && "body" in err && (err as any).status === 400) {
    res.status(400).json({
      error: "BAD_REQUEST",
      message: "Malformed JSON payload in request body.",
    });
    return;
  }

  // Handle Payload Too Large Errors (HTTP 413)
  if (err.type === "entity.too.large" || err.status === 413) {
    res.status(413).json({
      error: "PAYLOAD_TOO_LARGE",
      message: "Request payload exceeds the maximum allowed size.",
    });
    return;
  }

  // Handle CORS Rejection
  if (err.code === "CORS_FORBIDDEN" || err.message === "Not allowed by CORS") {
    res.status(403).json({
      error: "CORS_FORBIDDEN",
      message: "Origin is not authorized to access this resource.",
    });
    return;
  }

  const status = err.status || 500;
  const errorCode = err.code || (status === 500 ? "INTERNAL_ERROR" : "ERROR");
  const errorMessage =
    status === 500 && isProduction
      ? "An unexpected internal server error occurred."
      : err.message || "Internal Server Error";

  res.status(status).json({
    error: errorCode,
    message: errorMessage,
  });
});

export function createServerInstance() {
  const server = http.createServer(app);
  const wss = setupDeepgramWebSocketServer(server);
  return { server, wss, app };
}

export async function startServer() {
  // 1. Verify Database & Run Pending Migrations
  const dbConnected = await checkDatabaseConnection();
  if (dbConnected) {
    console.log("Meoow database connected successfully");
    try {
      await runMigrations();
    } catch (migErr) {
      console.error("Database migration check warning on startup:", migErr);
    }
  } else {
    console.error("Failed to connect to Meoow database");
  }

  // 2. Validate JWT_SECRET
  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is not defined.");
    process.exit(1);
  }

  // 3. Start Listener with 0.0.0.0 binding and WebSocket support
  const { server } = createServerInstance();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Meoow API & WebSocket running on port ${PORT}`);
  });
}

// Start server if main module
if (require.main === module) {
  startServer();
}

export default app;

