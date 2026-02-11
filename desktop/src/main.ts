import {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  shell,
} from 'electron';
import { join } from 'node:path';
import { startServer, stopServer, getServerUrl } from './php-server.js';
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
    trafficLightPosition: { x: 16, y: 16 },
    title: 'Whoami Wiki',
    webPreferences: {
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
    const titleBarHeight = 38;
    wikiView.setBounds({
      x: 0,
      y: titleBarHeight,
      width,
      height: height - titleBarHeight,
    });
  };

  mainWindow.on('resize', resizeView);
  resizeView();

  // Update window title based on wiki page
  wikiView.webContents.on('page-title-updated', (_event, title) => {
    // Strip " - Whoami Wiki" suffix if present
    const clean = title.replace(/\s*[-–—]\s*Whoami Wiki$/, '');
    mainWindow?.setTitle(clean || 'Whoami Wiki');
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

  // Make the titlebar area draggable
  mainWindow.loadURL('data:text/html,<html><body style="margin:0"><div style="-webkit-app-region:drag;height:38px"></div></body></html>');

  wikiView.webContents.loadURL(getServerUrl());

  // Keyboard shortcuts for navigation
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (!wikiView) return;
    if (input.meta && input.key === '[') {
      wikiView.webContents.goBack();
    } else if (input.meta && input.key === ']') {
      wikiView.webContents.goForward();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    wikiView = null;
    stopServer();
  });

  initAutoUpdater(mainWindow);
}
