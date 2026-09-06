import os from "os";
import { BrowserWindow } from "electron";
import koffi from "koffi";

const WDA_NONE = 0x00000000;
const WDA_MONITOR = 0x00000001;
const WDA_EXCLUDEFROMCAPTURE = 0x00000011;

let windowsAffinityApi: any;

function getWindowsBuildNumber() {
  return parseInt(os.release().split(".")[2] ?? "0", 10);
}

export function isContentProtectionFullySupported() {
  if (process.platform === "win32") {
    return getWindowsBuildNumber() >= 19041;
  }
  return process.platform === "darwin";
}

function getHwnd(win: BrowserWindow) {
  const handle = win.getNativeWindowHandle();
  if (handle.length >= 8) return handle.readBigUInt64LE(0);
  return BigInt(handle.readUInt32LE(0));
}

function setAndReadWindowsAffinity(win: BrowserWindow, affinity: number) {
  try {
    if (!windowsAffinityApi) {
      const koffi = require("koffi");
      const user32 = koffi.load("user32.dll");
      const HANDLE = koffi.pointer("MeowHANDLE", koffi.opaque());
      koffi.alias("MeowHWND", HANDLE);
      windowsAffinityApi = {
        setAffinity: user32.func("bool __stdcall SetWindowDisplayAffinity(MeowHWND hWnd, uint32_t affinity)"),
        getAffinity: user32.func("bool __stdcall GetWindowDisplayAffinity(MeowHWND hWnd, _Out_ uint32_t *affinity)"),
      };
    }

    const hwnd = getHwnd(win);
    const applied = Boolean(windowsAffinityApi.setAffinity(hwnd, affinity));
    const output = [WDA_NONE];
    const read = Boolean(windowsAffinityApi.getAffinity(hwnd, output));

    return { applied, actual: read ? output[0] : null };
  } catch (error) {
    console.error("[Meow] Native window-affinity check failed:", error);
    return { applied: false, actual: null };
  }
}

const GWL_EXSTYLE = -20;
const WS_EX_TOOLWINDOW = 0x00000080;

let windowsStyleApi: any;

export function applyWindowsAltTabHiding(win: BrowserWindow) {
  if (process.platform !== "win32" || win.isDestroyed()) return;

  try {
    if (!windowsStyleApi) {
      const koffi = require("koffi");
      const user32 = koffi.load("user32.dll");
      const HANDLE = koffi.pointer("MeowHANDLE_style", koffi.opaque());
      koffi.alias("MeowHWND_style", HANDLE);

      const is64Bit = process.arch === "x64" || process.arch === "arm64";
      const getFunc = is64Bit ? "GetWindowLongPtrW" : "GetWindowLongW";
      const setFunc = is64Bit ? "SetWindowLongPtrW" : "SetWindowLongW";

      windowsStyleApi = {
        getWindowLong: user32.func(`intptr_t __stdcall ${getFunc}(MeowHWND_style hWnd, int nIndex)`),
        setWindowLong: user32.func(`intptr_t __stdcall ${setFunc}(MeowHWND_style hWnd, int nIndex, intptr_t dwNewLong)`),
      };
    }

    const hwnd = getHwnd(win);
    const currentExStyle = BigInt(windowsStyleApi.getWindowLong(hwnd, GWL_EXSTYLE));
    const targetExStyle = currentExStyle | BigInt(WS_EX_TOOLWINDOW);

    windowsStyleApi.setWindowLong(hwnd, GWL_EXSTYLE, targetExStyle);
    console.log("[Meow] Windows Alt-Tab hiding (WS_EX_TOOLWINDOW) applied");
  } catch (error) {
    console.error("[Meow] Failed to apply Windows Alt-Tab hiding style:", error);
  }
}

export function applyContentProtection(win: BrowserWindow) {
  if (win.isDestroyed()) return false;

  if (process.platform === "darwin") {
    win.setContentProtection(true);
    return true;
  }

  if (process.platform !== "win32") return false;

  win.setContentProtection(true);

  const desired = isContentProtectionFullySupported()
    ? WDA_EXCLUDEFROMCAPTURE
    : WDA_MONITOR;
  let result = setAndReadWindowsAffinity(win, desired);

  if (!result.applied || result.actual !== desired) {
    win.setContentProtection(false);
    win.setContentProtection(true);
    result = setAndReadWindowsAffinity(win, desired);
  }

  const protectedAtOsLevel = result.applied && result.actual === desired;
  if (protectedAtOsLevel) {
    console.log(`[Meow] Windows capture protection verified (affinity=0x${desired.toString(16)})`);
  } else {
    console.error("[Meow] Windows rejected capture protection", result);
  }

  return protectedAtOsLevel;
}

export function removeContentProtection(win: BrowserWindow) {
  if (win.isDestroyed()) return;
  win.setContentProtection(false);
  if (process.platform === "win32") {
    setAndReadWindowsAffinity(win, WDA_NONE);
  }
}

export function applyPrivateMode(win: BrowserWindow, enabled: boolean) {
  if (enabled) {
    applyContentProtection(win);
    win.setAlwaysOnTop(true, "screen-saver", 1);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setSkipTaskbar(true);

    if (process.platform === "darwin") {
      win.setHiddenInMissionControl(true);
      win.setWindowButtonVisibility(false);
      win.setHasShadow(false);
    } else if (process.platform === "win32") {
      win.setMenuBarVisibility(false);
      win.setAutoHideMenuBar(true);
    }
  } else {
    removeContentProtection(win);
  }
}
