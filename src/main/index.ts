import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ESM polyfill for __dirname (not available in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root if present (dev / local testing)
import { config as dotenvConfig } from "dotenv";
import path from "path";
import fs from "fs";

// Try multiple possible locations for .env
const _envPaths = [
  path.join(path.dirname(process.execPath), ".env"),          // alongside executable
  process.resourcesPath ? path.join(process.resourcesPath, ".env") : "", // inside resources folder
  path.join(app ? app.getPath("userData") : "", ".env"),      // inside userData folder
  path.join(__dirname, "..", "..", "..", ".env"),           // dev: dist/electron/main/ -> root
  path.join(__dirname, "..", "..", ".env"),                  // fallback
  path.join(process.cwd(), ".env"),                          // cwd fallback
].filter(Boolean);

for (const _p of _envPaths) {
  try {
    if (fs.existsSync(_p)) {
      const { error } = dotenvConfig({ path: _p });
      if (!error) {
        console.log("[Meoow] Loaded .env from", _p);
        break;
      }
      // Fallback manual key-value parser if dotenv fails
      const content = fs.readFileSync(_p, "utf-8");
      content.split("\n").forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = (match[2] || "").trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val;
        }
      });
      console.log("[Meoow] Manually parsed .env from", _p);
      break;
    }
  } catch (_) {}
}

import { app, BrowserWindow, screen, desktopCapturer, systemPreferences, shell, globalShortcut, session } from "electron";
import { isContentProtectionFullySupported, applyContentProtection, removeContentProtection, applyPrivateMode as applyPrivateModeHelper } from "./windowProtection";
import { parseSessionStartUrl } from "./deepLink";
import { registerIpcHandlers } from "./ipcHandlers";


let win: BrowserWindow | null = null;
let captureWin: BrowserWindow | null = null;
let isIgnoringMouseEvents = false;
const PROTOCOL = "meow";
let pendingSessionStart: any = null;
let isPrivateModeEnabled = true;

const EVENTS = {
  SESSION_START: "session:start",
  SCREEN_PERMISSION_STATUS: "screen:permission:status",
  ANALYZE_SCREEN_SHORTCUT: "shortcut:analyze-screen",
  PROTECTION_SUPPORTED: "privacy:protection-supported",
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

function getAppIconPath() {
  const isProd = app.isPackaged;
  const filename = process.platform === "darwin" ? "logo.icns" : process.platform === "win32" ? "logo.ico" : "logo.png";
  
  if (isProd) {
    const candidates = [
      path.join(process.resourcesPath, filename),
      path.join(process.resourcesPath, "icon.ico"),
      path.join(process.resourcesPath, "logo.ico"),
      path.join(process.resourcesPath, "icon.png"),
    ];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) return c;
      } catch {}
    }
  }
  
  const devCandidates = [
    path.join(app.getAppPath(), "resources", filename),
    path.join(app.getAppPath(), "resources", "icon.ico"),
    path.join(app.getAppPath(), "src", "assets", filename),
  ];
  for (const c of devCandidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return path.join(app.getAppPath(), "src", "assets", filename);
}

const toFiniteInteger = (value: any) =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;

function handleDisplayMediaRequest(request: any, callback: any) {
  const audio = request.audioRequested && process.platform !== "linux" ? { audio: "loopback" } : {};
  if (!request.videoRequested) {
    callback(audio);
    return;
  }
  void desktopCapturer
    .getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })
    .then((sources) => {
      const primaryScreen = sources[0];
      callback(primaryScreen ? { video: primaryScreen, ...audio } : {});
    })
    .catch((error) => {
      console.error("[Meow] Failed to grant display media:", error);
      callback({});
    });
}

function checkScreenSharingPermissionStatus() {
  if (process.platform !== "darwin") return true;
  try {
    return systemPreferences.getMediaAccessStatus("screen") === "granted";
  } catch (error) {
    console.error("[Meow] Error checking screen sharing permission:", error);
    return false;
  }
}

async function checkAndRequestScreenSharingPermission() {
  if (process.platform !== "darwin") return true;
  try {
    const hasPermission = systemPreferences.getMediaAccessStatus("screen") === "granted";
    if (hasPermission) return true;
    try {
      await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 1, height: 1 } });
      return systemPreferences.getMediaAccessStatus("screen") === "granted";
    } catch {
      return false;
    }
  } catch (error) {
    console.error("[Meow] Error checking screen sharing permission:", error);
    return false;
  }
}

function createCaptureWindow() {
  if (!app.isReady()) {
    app.whenReady().then(() => createCaptureWindow());
    return;
  }
  if (captureWin) return;
  const sessionToUse = win?.webContents?.session;
  captureWin = new BrowserWindow({
    width: 1,
    height: 1,
    x: -100,
    y: -100,
    show: false,
    frame: false,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "capturePreload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...(sessionToUse && { session: sessionToUse }),
    },
  });
  captureWin.webContents.setBackgroundThrottling(false);

  captureWin.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media" || permission === "mediaKeySystem") callback(true);
    else callback(false);
  });
  captureWin.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return (permission === "media" || permission === "mediaKeySystem");
  });
  captureWin.webContents.session.setDisplayMediaRequestHandler(handleDisplayMediaRequest);

  const captureHtmlPath = process.env.VITE_DEV_SERVER_URL 
    ? path.join(__dirname, "..", "..", "dist", "capture.html")
    : path.join(__dirname, "..", "..", "dist", "capture.html"); // Simplified for brevity

  captureWin.webContents.on("console-message", (_event, level, message) => {
    console.log(`[CaptureWindow] ${message}`);
  });
  captureWin.webContents.on("did-fail-load", (_event, errorCode, errorDesc) => {
    console.error("[Meow] Capture window failed to load:", errorCode, errorDesc);
  });
  
  if (process.env.VITE_DEV_SERVER_URL) {
      captureWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}capture.html`);
  } else {
      captureWin.loadFile(path.join(__dirname, '..', '..', '..', 'dist', 'capture.html'));
  }

  captureWin.on("closed", () => {
    captureWin = null;
  });
}

function createWindow() {
  if (win) return;
  if (!app.isReady()) {
    app.whenReady().then(() => createWindow());
    return;
  }
  const display = screen.getPrimaryDisplay();
  const screenBounds = display.bounds;
  const winWidth = Math.min(960, Math.floor(screenBounds.width * 0.85));
  const winHeight = Math.floor(screenBounds.height * 0.9);
  const x = Math.round(screenBounds.x + (screenBounds.width - winWidth) / 2);
  const y = screenBounds.y;

  win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 720,
    minHeight: 300,
    x,
    y,
    frame: false,
    titleBarStyle: "hidden",
    // 'panel' type on Windows prevents keyboard focus — only use on macOS
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    paintWhenInitiallyHidden: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: true,
    acceptFirstMouse: true,
    show: false,
    skipTaskbar: true,
    thickFrame: false,
    autoHideMenuBar: true,
    hasShadow: false,
    hiddenInMissionControl: true,
    transparent: true,
    backgroundColor: "#00000000",
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  win.webContents.setBackgroundThrottling(false);
  win.webContents.setFrameRate(60);
  win.setIgnoreMouseEvents(false);
  isIgnoringMouseEvents = false;

  win.once("ready-to-show", () => {
    if (win && isPrivateModeEnabled) applyContentProtection(win);
    // Use show() on Windows so the window receives keyboard focus
    // showInactive() on Windows causes keyboard events to go to other apps
    if (process.platform === "win32") {
      win?.show();
      win?.setSkipTaskbar(true);
      win?.webContents.focus();
    } else {
      win?.showInactive();
    }
  });
  win.on("show", () => {
    if (win) {
      win.setSkipTaskbar(true);
      if (isPrivateModeEnabled) applyContentProtection(win);
    }
  });
  win.on("restore", () => {
    if (win) {
      win.setSkipTaskbar(true);
      if (isPrivateModeEnabled) applyContentProtection(win);
    }
  });

  win.webContents.on("console-message", (_event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    const allowedDomains = [
      "https://meooow.tech",
      "https://www.meooow.tech",
      "https://meow.app",
    ];
    if (allowedDomains.some((domain) => url.startsWith(domain))) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, navigationUrl) => {
    const allowedOrigins = [
      "http://localhost:5173",
      "file://",
      "https://meooow.tech",
      "https://www.meooow.tech",
      "https://meow.app",
    ];
    if (!allowedOrigins.some((origin) => navigationUrl.startsWith(origin))) {
      event.preventDefault();
    }
  });

  win.setMinimumSize(400, 300);
  win.setMaximumSize(10000, 10000);
  win.setAlwaysOnTop(true, "screen-saver", 1);
  if (process.platform === "darwin") {
    win.setHiddenInMissionControl(true);
    win.setWindowButtonVisibility(false);
    win.setHasShadow(false);
  } else if (process.platform === "win32") {
    win.setMenuBarVisibility(false);
    win.setAutoHideMenuBar(true);
  }
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyPrivateMode(win, isPrivateModeEnabled);
  win.setSkipTaskbar(true);

  const isDevMode = !!process.env.VITE_DEV_SERVER_URL;
  const scriptSrc = isDevMode
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.razorpay.com https://*.razorpay.in https://cdnjs.cloudflare.com;"
    : "script-src 'self' 'unsafe-inline' https://*.razorpay.com https://*.razorpay.in https://cdnjs.cloudflare.com;";
  // Rewrite Origin for Meoow API and WebSocket requests so Render's CORS allowlist is satisfied
  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    const url = details.url.toLowerCase();
    if (url.includes("api.meooow.tech") || url.includes("api.meoow.tech")) {
      requestHeaders["Origin"] = "https://meooow.tech";
    }
    callback({ requestHeaders });
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url.toLowerCase();
    // Do NOT inject or overwrite CSP headers on external third-party resources (Razorpay, CDNs, fonts, etc.)
    if (
      url.includes("razorpay.com") ||
      url.includes("razorpay.in") ||
      url.includes("cloudflare.com") ||
      url.includes("popclub.co") ||
      url.includes("sentry-cdn.com") ||
      url.includes("googleapis.com") ||
      url.includes("gstatic.com")
    ) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    const responseHeaders = { ...details.responseHeaders };

    // For Meoow API requests, ensure unified lowercase permissive CORS headers and avoid injecting app CSP
    if (url.includes("api.meooow.tech") || url.includes("api.meoow.tech")) {
      for (const key of Object.keys(responseHeaders)) {
        if (key.toLowerCase().startsWith("access-control-allow-")) {
          delete responseHeaders[key];
        }
      }
      responseHeaders["access-control-allow-origin"] = ["*"];
      responseHeaders["access-control-allow-methods"] = ["GET, POST, PUT, DELETE, PATCH, OPTIONS"];
      responseHeaders["access-control-allow-headers"] = ["*"];
      callback({ responseHeaders });
      return;
    }

    callback({
      responseHeaders: {
        ...responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' http://localhost:* blob: filesystem:;" +
          "connect-src 'self' https://api.meooow.tech wss://api.meooow.tech https://*.razorpay.com https://*.razorpay.in https://lumberjack.razorpay.com http: https: ws: wss: blob: filesystem:;" +
          "media-src 'self' http://localhost:* blob: filesystem:;" +
          "img-src 'self' blob: data: filesystem: https://*.razorpay.com https://*.razorpay.in;" +
          "font-src 'self' data: https://*.razorpay.com https://*.razorpay.in https://fonts.gstatic.com;" +
          "frame-src 'self' https://*.razorpay.com https://*.razorpay.in;" +
          scriptSrc +
          "style-src 'self' 'unsafe-inline' https://*.razorpay.com https://*.razorpay.in https://fonts.googleapis.com;",
        ],
      },
    });
  });

  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media" || permission === "mediaKeySystem") callback(true);
    else callback(false);
  });
  win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return (permission === "media" || permission === "mediaKeySystem");
  });
  win.webContents.session.setDisplayMediaRequestHandler(handleDisplayMediaRequest);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', '..', '..', 'dist', 'index.html'));
  }

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && (input.key === "F12" || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === "i"))) {
      win?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.on("closed", () => {
    win = null;
    isIgnoringMouseEvents = false;
  });

  win.webContents.once("did-finish-load", () => {
    const hasScreenPermission = checkScreenSharingPermissionStatus();
    win?.webContents.send(EVENTS.SCREEN_PERMISSION_STATUS, hasScreenPermission);
    win?.webContents.send(EVENTS.PROTECTION_SUPPORTED, isContentProtectionFullySupported());
  });
}

function applyPrivateMode(targetWindow: BrowserWindow, enabled: boolean) {
  applyPrivateModeHelper(targetWindow, enabled);
}

function showInactiveWindow() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.showInactive();
}

function handleDeepLink(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== `${PROTOCOL}:`) return;
    const sessionStart = parseSessionStartUrl(u, PROTOCOL);
    if (!sessionStart) return;
    pendingSessionStart = sessionStart.payload;
    showInactiveWindow();
    if (process.platform === "darwin" && app.dock) {
      app.dock.hide();
    }
    if (win && !win.webContents.isLoading()) {
      win.webContents.send(EVENTS.SESSION_START);
    }
  } catch (e) {
    console.error("Deep link parse error", e);
  }
}

let isToggling = false;
function toggleWindowVisibility() {
  if (isToggling) return;
  isToggling = true;
  if (!win) {
    createWindow();
  } else if (win.isVisible()) {
    win.hide();
  } else {
    showInactiveWindow();
  }
  setTimeout(() => { isToggling = false; }, 300);
}

function moveWindow(deltaX: number, deltaY = 0) {
  if (!win) return;
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const minX = display.workArea.x;
  const maxX = display.workArea.x + display.workArea.width - bounds.width;
  const nextX = Math.max(minX, Math.min(bounds.x + deltaX, maxX));
  
  // Allow moving up and down freely while keeping at least headerHeight on screen
  const headerHeight = 70;
  const minY = display.workArea.y - (bounds.height - headerHeight);
  const maxY = display.workArea.y + display.workArea.height - headerHeight;
  const nextY = Math.max(minY, Math.min(bounds.y + deltaY, maxY));
  win.setPosition(nextX, nextY);
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+H", () => {
    toggleWindowVisibility();
  });
  globalShortcut.register("CommandOrControl+Shift+A", () => {
    if (!win) {
      createWindow();
      return;
    }
    if (!win.isVisible()) showInactiveWindow();
    win.webContents.send(EVENTS.ANALYZE_SCREEN_SHORTCUT);
  });
  globalShortcut.register("Alt+Left", () => moveWindow(-20, 0));
  globalShortcut.register("Alt+Right", () => moveWindow(20, 0));
  globalShortcut.register("Alt+Up", () => moveWindow(0, -20));
  globalShortcut.register("Alt+Down", () => moveWindow(0, 20));
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    win?.webContents.toggleDevTools();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.exit(0);
} else {
  app.on("second-instance", (_e, argv) => {
    const linkArg = argv.find((a) => a.startsWith?.(`${PROTOCOL}://`));
    if (linkArg) handleDeepLink(linkArg);
    showInactiveWindow();
  });
}

if (process.platform === "darwin") {
  app.commandLine.appendSwitch("disable-features", "MacCatapLoopbackAudioForScreenShare");
}

app.setName("Meow");
process.title = "Meow";

function registerProtocolClient() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    return;
  }
  app.setAsDefaultProtocolClient(PROTOCOL);
}

if (process.platform === "darwin" && app.dock) {
  app.dock.hide();
}

app.whenReady().then(async () => {
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
    try {
      app.dock.setIcon(getAppIconPath());
    } catch (error) {
      console.log("Could not set dock icon:", error);
    }
  }
  try { registerProtocolClient(); } catch { }

  registerIpcHandlers(
    () => win,
    () => captureWin,
    createCaptureWindow,
    showInactiveWindow
  );
  createWindow();
  registerShortcuts();

  const argUrl = process.argv.find((a) => a.startsWith?.(`${PROTOCOL}://`));
  if (argUrl) handleDeepLink(argUrl);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("will-quit", () => {
  if (app.isReady()) {
    globalShortcut.unregisterAll();
  }
});
app.on("open-url", (e, urlStr) => {
  e.preventDefault();
  handleDeepLink(urlStr);
});
