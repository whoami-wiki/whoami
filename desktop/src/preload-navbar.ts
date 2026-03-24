import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('navbar', {
  goBack: () => ipcRenderer.send('navbar:go-back'),
  goForward: () => ipcRenderer.send('navbar:go-forward'),
  openSettings: () => ipcRenderer.send('settings:open'),
  closeSettings: () => ipcRenderer.send('settings:close'),
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean }) =>
    ipcRenderer.send('find:query', text, options),
  stopFindInPage: () => ipcRenderer.send('find:close'),

  onNavigationState: (callback: (state: { canGoBack: boolean; canGoForward: boolean }) => void) => {
    ipcRenderer.on('navbar:navigation-state', (_event, state) => callback(state));
  },

  onTitleUpdate: (callback: (title: string) => void) => {
    ipcRenderer.on('navbar:title-update', (_event, title) => callback(title));
  },

  onFindShow: (callback: () => void) => {
    ipcRenderer.on('find:show', () => callback());
  },

  onFindResult: (callback: (result: { activeMatchOrdinal: number; matches: number }) => void) => {
    ipcRenderer.on('find:result', (_event, result) => callback(result));
  },
});
