import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('captureAPI', {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  sendAudioData: (data: number[]) => ipcRenderer.send('audio:data', data),
  notifyCaptureStarted: () => ipcRenderer.send('audio:capture-started'),
  notifyCaptureStopped: () => ipcRenderer.send('audio:capture-stopped'),
  notifyCaptureRestarting: (attempt: number, maxRetries: number) => 
    ipcRenderer.send('audio:capture-restarting', attempt, maxRetries),
  notifyCaptureError: (error: string) => ipcRenderer.send('audio:capture-error', error),
  
  onStartCapture: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('audio:start-capture', listener);
    return () => ipcRenderer.off('audio:start-capture', listener);
  },
  onStopCapture: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('audio:stop-capture', listener);
    return () => ipcRenderer.off('audio:stop-capture', listener);
  }
});
