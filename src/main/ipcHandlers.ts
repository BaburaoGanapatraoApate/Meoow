import { ipcMain, app, shell, desktopCapturer, dialog, BrowserWindow, screen, systemPreferences } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { isContentProtectionFullySupported, applyPrivateMode } from "./windowProtection";
import { parseResume } from "./resumeParser";
import { getAuthToken, setAuthToken, clearAuthToken } from "./tokenStorage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
const toFiniteInteger = (value: any) =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;

let isPrivateModeEnabled = true;

export function registerIpcHandlers(
  getWin: () => BrowserWindow | null,
  getCaptureWin: () => BrowserWindow | null,
  createCaptureWindow: () => void,
  showInactiveWindow: () => void
) {
  // Window control
  ipcMain.on("window:set-ignore-mouse-events", (event, ignore) => {
    const win = getWin();
    if (!win || event.sender !== win.webContents) return;
    // On Windows, win.setIgnoreMouseEvents(true) applies WS_EX_TRANSPARENT,
    // which prevents the window from receiving WM_LBUTTONDOWN clicks on buttons.
    // Keep window interactive at all times.
    if (process.platform === "win32") {
      win.setIgnoreMouseEvents(false);
    } else {
      const shouldIgnore = Boolean(ignore);
      if (shouldIgnore) {
        win.setIgnoreMouseEvents(true, { forward: true });
      } else {
        win.setIgnoreMouseEvents(false);
      }
    }
  });

  ipcMain.on("window:set-focusable", (event, focusable) => {
    const win = getWin();
    if (!win || event.sender !== win.webContents) return;
    if (process.platform === "win32") {
      const isFocusable = Boolean(focusable);
      win.setFocusable(isFocusable);
      if (isFocusable) {
        win.focus();
      }
    }
  });

  ipcMain.on("window:set-input-focus", (event) => {
    const win = getWin();
    if (!win || event.sender !== win.webContents) return;
    if (process.platform === "win32") {
      win.setFocusable(true);
    }
  });

  ipcMain.on("window:request-focus", (event) => {
    const win = getWin();
    if (!win || event.sender !== win.webContents) return;
    if (process.platform === "win32") {
      win.setFocusable(true);
    }
  });

  ipcMain.handle("window:get-bounds", () => {
    const win = getWin();
    return win?.getBounds() ?? null;
  });

  ipcMain.handle("window:set-bounds", (_event, bounds) => {
    const win = getWin();
    if (!win) return null;
    const current = win.getBounds();
    const display = screen.getDisplayMatching(current);
    const workArea = display.workArea;

    const minWidth = 400;
    const maxWidth = Math.max(minWidth, workArea.width);

    const requestedWidth = toFiniteInteger(bounds?.width);
    const requestedX = toFiniteInteger(bounds?.x);

    const nextWidth = clamp(requestedWidth ?? current.width, minWidth, maxWidth);
    const maxX = workArea.x + workArea.width - nextWidth;
    const nextX = clamp(requestedX ?? current.x, workArea.x, Math.max(workArea.x, maxX));

    win.setBounds({
      x: nextX,
      y: current.y,
      width: nextWidth,
      height: current.height,
    });
    return win.getBounds();
  });

  ipcMain.on("app:end", () => {
    app.quit();
  });

  ipcMain.handle("app:minimize-to-tray", () => {
    const win = getWin();
    if (win) win.hide();
  });

  ipcMain.handle("app:show", () => {
    showInactiveWindow();
  });

  ipcMain.handle("app:get-version", () => {
    return app.getVersion();
  });

  ipcMain.on("open-external", (_e, url) => {
    if (!url || typeof url !== "string") return;
    shell.openExternal(url, { activate: true }).catch((err) => {
      console.error("openExternal failed:", err);
    });
  });

  // Privacy
  ipcMain.handle("privacy:get-protection-supported", () => {
    return isContentProtectionFullySupported();
  });

  ipcMain.handle("privacy:set-private-mode", (_event, enabled) => {
    isPrivateModeEnabled = Boolean(enabled);
    const win = getWin();
    if (win) {
      applyPrivateMode(win, isPrivateModeEnabled);
    }
    return isPrivateModeEnabled;
  });

  // Screen
  ipcMain.handle("check-screen-permission", () => {
    if (process.platform !== "darwin") return true;
    try {
      return systemPreferences.getMediaAccessStatus("screen") === "granted";
    } catch {
      return false;
    }
  });

  ipcMain.handle("request-screen-permission", async () => {
    if (process.platform !== "darwin") return true;
    try {
      if (systemPreferences.getMediaAccessStatus("screen") === "granted") return true;
      await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 1, height: 1 } });
      return systemPreferences.getMediaAccessStatus("screen") === "granted";
    } catch {
      return false;
    }
  });

  ipcMain.handle("get-screen-sources", async () => {
    try {
      const primaryDisplayId = String(screen.getPrimaryDisplay().id);
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1, height: 1 },
      });
      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        display_id: source.display_id,
        isPrimary: String(source.display_id) === primaryDisplayId,
      }));
    } catch (error) {
      console.error("Failed to get screen sources:", error);
      return [];
    }
  });

  // Audio capture relay
  ipcMain.handle("audio:start-capture", async () => {
    let captureWin = getCaptureWin();
    try {
      if (!captureWin) {
        createCaptureWindow();
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Capture window creation timeout"));
          }, process.platform === "win32" ? 20000 : 10000);
          
          const checkWindow = () => {
            const cw = getCaptureWin();
            if (cw) {
              cw.webContents.once("did-finish-load", () => {
                clearTimeout(timeout);
                resolve();
              });
              cw.webContents.once("did-fail-load", (_event, errorCode, errorDesc) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to load: ${errorDesc}`));
              });
            } else {
              setTimeout(checkWindow, 100);
            }
          };
          checkWindow();
        });
        captureWin = getCaptureWin();
      }
      
      if (captureWin) {
        captureWin.webContents.send("audio:start-capture");
        return true;
      }
      return false;
    } catch (error) {
      console.error("[Meow] Failed to start audio capture:", error);
      return false;
    }
  });

  ipcMain.handle("audio:stop-capture", async () => {
    const captureWin = getCaptureWin();
    if (captureWin) {
      captureWin.webContents.send("audio:stop-capture");
    }
    return true;
  });

  ipcMain.on("audio:data", (_event, data) => {
    const win = getWin();
    if (win) win.webContents.send("audio:data-to-renderer", data);
  });

  ipcMain.on("audio:capture-started", () => {
    const win = getWin();
    if (win) win.webContents.send("audio:capture-started");
  });

  ipcMain.on("audio:capture-stopped", () => {
    const win = getWin();
    if (win) win.webContents.send("audio:capture-stopped");
    const captureWin = getCaptureWin();
    if (captureWin) {
      captureWin.close();
    }
  });

  ipcMain.on("audio:capture-restarting", (_event, attempt, maxRetries) => {
    const win = getWin();
    if (win) win.webContents.send("audio:capture-restarting", attempt, maxRetries);
  });

  ipcMain.on("audio:capture-error", (_event, error) => {
    const win = getWin();
    if (win) win.webContents.send("audio:capture-error", error);
  });

  // Resume
  ipcMain.handle("resume:parse-local", async (_event, filePath) => {
    return await parseResume(filePath);
  });

  ipcMain.handle("resume:pick-file", async () => {
    try {
      const win = getWin();
      const options = {
        title: "Select Your Resume",
        properties: ["openFile" as const],
        filters: [
          { name: "Resumes", extensions: ["pdf", "docx", "txt"] }
        ]
      };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const text = await parseResume(filePath);
        console.log(`[Meow] Picked resume: ${filePath}, parsed ${text?.length ?? 0} chars`);
        return { filePath, text };
      }
      return null;
    } catch (err: any) {
      console.error("[Meow] Error picking resume:", err);
      return null;
    }
  });

  // API Key Status (Groq and Deepgram are managed securely by the backend)
  ipcMain.handle("app:get-api-key-status", () => {
    return {
      groq: true,
      deepgram: true
    };
  });

  // Secure Auth Token Storage
  ipcMain.handle("auth:get-token", () => {
    return getAuthToken();
  });

  ipcMain.handle("auth:set-token", (_event, token: string) => {
    return setAuthToken(token);
  });

  ipcMain.handle("auth:clear-token", () => {
    return clearAuthToken();
  });

  // Secure Razorpay Payment Checkout Window
  let activePaymentWin: BrowserWindow | null = null;

  function getPaymentIconPath() {
    const isProd = app.isPackaged;
    const filename = process.platform === "darwin" ? "logo.icns" : process.platform === "win32" ? "logo.ico" : "logo.png";
    if (isProd && process.resourcesPath) {
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
    return undefined;
  }

  ipcMain.handle("payment:open-checkout", async (_event, options: any) => {
    return new Promise((resolve) => {
      try {
        if (activePaymentWin && !activePaymentWin.isDestroyed()) {
          activePaymentWin.focus();
          return;
        }

        const preloadPath = path.join(__dirname, "..", "preload", "paymentPreload.js");

        activePaymentWin = new BrowserWindow({
          width: 480,
          height: 720,
          minWidth: 400,
          minHeight: 600,
          show: false,
          transparent: false,
          backgroundColor: "#0f172a",
          alwaysOnTop: true,
          frame: true,
          title: "Meoow - Secure Razorpay Checkout",
          autoHideMenuBar: true,
          center: true,
          icon: getPaymentIconPath(),
          webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
          },
        });

        let isResolved = false;
        const cleanup = () => {
          ipcMain.removeListener("payment:success", onPaymentSuccess);
          ipcMain.removeListener("payment:failed", onPaymentFailed);
          ipcMain.removeListener("payment:dismissed", onPaymentDismissed);
          if (activePaymentWin && !activePaymentWin.isDestroyed()) {
            activePaymentWin.destroy();
          }
          activePaymentWin = null;
        };

        const onPaymentSuccess = (_e: any, response: any) => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve({ success: true, data: response });
          }
        };

        const onPaymentFailed = (_e: any, errorMsg: string) => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve({ success: false, error: errorMsg });
          }
        };

        const onPaymentDismissed = () => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve({ success: false, dismissed: true });
          }
        };

        ipcMain.on("payment:success", onPaymentSuccess);
        ipcMain.on("payment:failed", onPaymentFailed);
        ipcMain.on("payment:dismissed", onPaymentDismissed);

        activePaymentWin.on("closed", () => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve({ success: false, dismissed: true });
          }
        });

        activePaymentWin.webContents.once("did-finish-load", () => {
          if (activePaymentWin && !activePaymentWin.isDestroyed()) {
            activePaymentWin.webContents.send("payment:init", options);
          }
        });

        activePaymentWin.once("ready-to-show", () => {
          if (activePaymentWin && !activePaymentWin.isDestroyed()) {
            activePaymentWin.show();
            activePaymentWin.focus();
          }
        });

        if (process.env.VITE_DEV_SERVER_URL) {
          activePaymentWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}payment.html`);
        } else {
          const candidates = [
            path.join(__dirname, "..", "..", "..", "dist", "payment.html"),
            path.join(app.getAppPath(), "dist", "payment.html"),
            path.join(__dirname, "..", "..", "dist", "payment.html"),
          ];
          const target = candidates.find((c) => fs.existsSync(c)) || candidates[0];
          activePaymentWin.loadFile(target);
        }
      } catch (err: any) {
        console.error("[Meoow] Failed to open payment window:", err);
        resolve({ success: false, error: err.message || "Failed to open payment gateway window" });
      }
    });
  });
}
