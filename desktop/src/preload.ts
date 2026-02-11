import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('whoami', {
  startSetup: (params: { name: string; username: string; password: string }) =>
    ipcRenderer.invoke('setup:start', params),

  onProgress: (callback: (data: { step: string; status: string; detail?: string }) => void) => {
    const listener = (_event: unknown, data: { step: string; status: string; detail?: string }) =>
      callback(data);
    ipcRenderer.on('setup:progress', listener);
    return () => ipcRenderer.removeListener('setup:progress', listener);
  },

  onSetupComplete: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('setup:complete', listener);
    return () => ipcRenderer.removeListener('setup:complete', listener);
  },

  onSetupError: (callback: (message: string) => void) => {
    const listener = (_event: unknown, message: string) => callback(message);
    ipcRenderer.on('setup:error', listener);
    return () => ipcRenderer.removeListener('setup:error', listener);
  },
});
