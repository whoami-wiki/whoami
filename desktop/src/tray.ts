import { Tray, Menu, nativeImage, shell, type BrowserWindow } from 'electron';
import { getDataPath, stopServer, startServer, isRunning, getServerUrl } from './php-server.js';

let tray: Tray | null = null;

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  // Use a template image for macOS menu bar (16x16)
  const icon = nativeImage.createFromNamedImage(
    'NSImageNameBookmarksTemplate',
    [-1, 0, 1],
  );

  tray = new Tray(icon);
  tray.setToolTip('Whoami Wiki');

  const updateMenu = () => {
    const running = isRunning();
    const menu = Menu.buildFromTemplate([
      {
        label: 'Open Wiki',
        click: () => {
          const win = getWindow();
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      {
        label: `Open in Browser`,
        enabled: running,
        click: () => {
          shell.openExternal(getServerUrl());
        },
      },
      { type: 'separator' },
      {
        label: running ? 'Stop Wiki' : 'Start Wiki',
        click: async () => {
          if (running) {
            stopServer();
          } else {
            await startServer();
          }
          updateMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Data Folder',
        click: () => {
          shell.openPath(getDataPath());
        },
      },
      {
        label: 'Quit',
        role: 'quit',
      },
    ]);
    tray?.setContextMenu(menu);
  };

  updateMenu();

  tray.on('click', () => {
    const win = getWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
