import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('paymentAPI', {
  notifySuccess: (response: any) => ipcRenderer.send('payment:success', response),
  notifyFailed: (error: string) => ipcRenderer.send('payment:failed', error),
  notifyDismissed: () => ipcRenderer.send('payment:dismissed'),
  onInit: (cb: (options: any) => void) => {
    const listener = (_e: any, options: any) => cb(options);
    ipcRenderer.on('payment:init', listener);
    return () => ipcRenderer.off('payment:init', listener);
  },
});
