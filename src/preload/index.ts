import { contextBridge, ipcRenderer, clipboard } from 'electron';

// Expose API to renderer
contextBridge.exposeInMainWorld('meow', {
  // Invoke (async) APIs
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  setPrivateMode: (enabled: boolean) => ipcRenderer.invoke('privacy:set-private-mode', enabled),
  getProtectionSupported: () => ipcRenderer.invoke('privacy:get-protection-supported'),
  checkScreenPermission: () => ipcRenderer.invoke('check-screen-permission'),
  requestScreenPermission: () => ipcRenderer.invoke('request-screen-permission'),
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  minimizeToTray: () => ipcRenderer.invoke('app:minimize-to-tray'),
  showApp: () => ipcRenderer.invoke('app:show'),
  getWindowBounds: () => ipcRenderer.invoke('window:get-bounds'),
  setWindowBounds: (bounds: any) => ipcRenderer.invoke('window:set-bounds', bounds),
  getApiKeyStatus: () => ipcRenderer.invoke('app:get-api-key-status'),
  startAudioCapture: () => ipcRenderer.invoke('audio:start-capture'),
  stopAudioCapture: () => ipcRenderer.invoke('audio:stop-capture'),
  parseResumeLocal: (filePath: string) => ipcRenderer.invoke('resume:parse-local', filePath),
  pickResumeFile: () => ipcRenderer.invoke('resume:pick-file'),
  getAuthToken: () => ipcRenderer.invoke('auth:get-token'),
  setAuthToken: (token: string) => ipcRenderer.invoke('auth:set-token', token),
  clearAuthToken: () => ipcRenderer.invoke('auth:clear-token'),

  // Send (one-way) APIs
  quitApp: () => ipcRenderer.send('app:end'),
  copyTextToClipboard: (text: string) => clipboard.writeText(text),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('window:set-ignore-mouse-events', ignore),
  setFocusable: (focusable: boolean) => ipcRenderer.send('window:set-focusable', focusable),
  setInputFocus: (focused: boolean) => ipcRenderer.send('window:set-input-focus', focused),
  requestFocus: () => ipcRenderer.send('window:request-focus'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),

  // Event listener APIs
  onProtectionSupported: (cb: (supported: boolean) => void) => {
    const listener = (_e: any, supported: boolean) => cb(supported);
    ipcRenderer.on('privacy:protection-supported', listener);
    return () => ipcRenderer.off('privacy:protection-supported', listener);
  },
  onScreenPermissionStatus: (cb: (status: string) => void) => {
    const listener = (_e: any, status: string) => cb(status);
    ipcRenderer.on('screen:permission:status', listener);
    return () => ipcRenderer.off('screen:permission:status', listener);
  },
  onAnalyzeScreenShortcut: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('shortcut:analyze-screen', listener);
    return () => ipcRenderer.off('shortcut:analyze-screen', listener);
  },
  onAudioData: (cb: (data: number[]) => void) => {
    const listener = (_e: any, data: number[]) => cb(data);
    ipcRenderer.on('audio:data-to-renderer', listener);
    return () => ipcRenderer.off('audio:data-to-renderer', listener);
  },
  onAudioCaptureStarted: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('audio:capture-started', listener);
    return () => ipcRenderer.off('audio:capture-started', listener);
  },
  onAudioCaptureStopped: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('audio:capture-stopped', listener);
    return () => ipcRenderer.off('audio:capture-stopped', listener);
  },
  onAudioCaptureError: (cb: (error: string) => void) => {
    const listener = (_e: any, error: string) => cb(error);
    ipcRenderer.on('audio:capture-error', listener);
    return () => ipcRenderer.off('audio:capture-error', listener);
  },

  // Constants
  platform: process.platform,
});

// Delete window variables to prevent security risks
delete (window as any).require;
delete (window as any).exports;
delete (window as any).module;
delete (window as any).global;
