import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('navbar', {
  goBack: () => ipcRenderer.send('navbar:go-back'),
  goForward: () => ipcRenderer.send('navbar:go-forward'),
  openSettings: (pos: { x: number; y: number }) => ipcRenderer.send('navbar:open-settings', pos),

  onNavigationState: (callback: (state: { canGoBack: boolean; canGoForward: boolean }) => void) => {
    ipcRenderer.on('navbar:navigation-state', (_event, state) => callback(state));
  },

  onTitleUpdate: (callback: (title: string) => void) => {
    ipcRenderer.on('navbar:title-update', (_event, title) => callback(title));
  },
});
