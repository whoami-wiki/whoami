import {
  app,
  BrowserWindow,
  Menu,
  WebContentsView,
  ipcMain,
  shell,
} from 'electron';
import { join } from 'node:path';
import { startServer, stopServer, getServerUrl, getDataPath } from './php-server.js';
import { isFirstRun, runSetup } from './setup.js';
import { createTray, destroyTray } from './tray.js';
import { initAutoUpdater } from './updater.js';

let mainWindow: BrowserWindow | null = null;
let wikiView: WebContentsView | null = null;

// ── App lifecycle ───────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (isFirstRun()) {
    showSetupWizard();
  } else {
    await launchWiki();
  }

  createTray(() => mainWindow);
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('before-quit', () => {
  stopServer();
  destroyTray();
});

app.on('activate', () => {
  if (mainWindow === null) {
    if (isFirstRun()) {
      showSetupWizard();
    } else {
      launchWiki();
    }
  }
});

// ── IPC handlers ────────────────────────────────────────────────────────

ipcMain.handle('setup:start', async (event, params: { name: string; username: string; password: string }) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  try {
    await runSetup(params, window);
    window.webContents.send('setup:complete');

    // Transition to wiki view after a brief pause
    setTimeout(async () => {
      window.close();
      await launchWiki();
    }, 1500);
  } catch (error: any) {
    console.error('[setup] error:', error);
    window.webContents.send('setup:error', error.message || 'Setup failed');
  }
});

// ── Setup wizard window ─────────────────────────────────────────────────

function showSetupWizard(): void {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 580,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'window',
    webPreferences: {
      preload: join(app.getAppPath(), 'dist', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const htmlPath = join(app.getAppPath(), 'renderer', 'index.html');
  mainWindow.loadFile(htmlPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Wiki window ─────────────────────────────────────────────────────────

async function launchWiki(): Promise<void> {
  await startServer();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    title: 'Whoami Wiki',
    webPreferences: {
      preload: join(app.getAppPath(), 'dist', 'src', 'preload-navbar.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Use a WebContentsView to render the wiki
  wikiView = new WebContentsView();
  mainWindow.contentView.addChildView(wikiView);

  // Fill the window, leaving space for the titlebar area
  const resizeView = () => {
    if (!mainWindow || !wikiView) return;
    const { width, height } = mainWindow.getContentBounds();
    const titleBarHeight = 48;
    wikiView.setBounds({
      x: 0,
      y: titleBarHeight,
      width,
      height: height - titleBarHeight,
    });
  };

  mainWindow.on('resize', resizeView);
  resizeView();

  // Update window title and navbar based on wiki page
  wikiView.webContents.on('page-title-updated', (_event, title) => {
    // Strip " - Whoami Wiki" suffix if present
    const clean = title.replace(/\s*[-–—]\s*Whoami Wiki$/, '');
    mainWindow?.setTitle(clean || 'Whoami Wiki');
    mainWindow?.webContents.send('navbar:title-update', clean || 'Whoami Wiki');
  });

  // Open external links in the system browser
  wikiView.webContents.setWindowOpenHandler(({ url }) => {
    const serverUrl = getServerUrl();
    if (!url.startsWith(serverUrl)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' }; // Navigate in-place instead
  });

  // Handle navigation to keep everything in the same view
  wikiView.webContents.on('will-navigate', (event, url) => {
    const serverUrl = getServerUrl();
    if (!url.startsWith(serverUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Load the navbar
  const navbarPath = join(app.getAppPath(), 'renderer', 'navbar.html');
  mainWindow.loadFile(navbarPath);

  wikiView.webContents.loadURL(getServerUrl());

  // Send navigation state to navbar on every navigation
  const sendNavigationState = () => {
    if (!wikiView || !mainWindow) return;
    mainWindow.webContents.send('navbar:navigation-state', {
      canGoBack: wikiView.webContents.canGoBack(),
      canGoForward: wikiView.webContents.canGoForward(),
    });
  };
  wikiView.webContents.on('did-navigate', sendNavigationState);
  wikiView.webContents.on('did-navigate-in-page', sendNavigationState);

  // Navbar IPC handlers
  const onGoBack = () => wikiView?.webContents.goBack();
  const onGoForward = () => wikiView?.webContents.goForward();
  const onOpenSettings = (_event: Electron.IpcMainEvent, pos: { x: number; y: number }) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Open in Browser',
        click: () => shell.openExternal(getServerUrl()),
      },
      {
        label: 'Data Folder',
        click: () => shell.openPath(getDataPath()),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        role: 'quit',
      },
    ]);
    menu.popup({ window: mainWindow!, x: pos.x, y: pos.y });
  };
  ipcMain.on('navbar:go-back', onGoBack);
  ipcMain.on('navbar:go-forward', onGoForward);
  ipcMain.on('navbar:open-settings', onOpenSettings);

  // Keyboard shortcuts for navigation (on both navbar and wiki webContents)
  const handleKeyboardNav = (_event: Electron.Event, input: Electron.Input) => {
    if (!wikiView) return;
    if (input.meta && input.key === '[') {
      wikiView.webContents.goBack();
    } else if (input.meta && input.key === ']') {
      wikiView.webContents.goForward();
    }
  };
  mainWindow.webContents.on('before-input-event', handleKeyboardNav);
  wikiView.webContents.on('before-input-event', handleKeyboardNav);

  mainWindow.on('closed', () => {
    ipcMain.removeListener('navbar:go-back', onGoBack);
    ipcMain.removeListener('navbar:go-forward', onGoForward);
    ipcMain.removeListener('navbar:open-settings', onOpenSettings);
    mainWindow = null;
    wikiView = null;
    stopServer();
  });

  initAutoUpdater(mainWindow);
}
