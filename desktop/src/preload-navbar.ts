import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('navbar', {
  goBack: () => ipcRenderer.send('navbar:go-back'),
  goForward: () => ipcRenderer.send('navbar:go-forward'),
  openSettings: () => ipcRenderer.send('settings:open'),
  closeSettings: () => ipcRenderer.send('settings:close'),
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  onNavigationState: (callback: (state: { canGoBack: boolean; canGoForward: boolean }) => void) => {
    ipcRenderer.on('navbar:navigation-state', (_event, state) => callback(state));
  },

  onTitleUpdate: (callback: (title: string) => void) => {
    ipcRenderer.on('navbar:title-update', (_event, title) => callback(title));
  },
});
