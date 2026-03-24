import {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  nativeTheme,
  shell,
} from "electron";
import { join } from "node:path";
import {
  startServer,
  stopServer,
  getServerUrl,
  getDataPath,
} from "./php-server.js";
import { isFirstRun, runSetup, refreshLocalSettings, runSchemaUpdate, autoLogin } from "./setup.js";
import { createTray, destroyTray } from "./tray.js";
import { initAutoUpdater } from "./updater.js";

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let wikiView: WebContentsView | null = null;
let isQuitting = false;

// ── App lifecycle ───────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (process.platform === "darwin" && !app.isPackaged) {
    app.dock.setIcon(join(app.getAppPath(), "build", "icon.png"));
  }

  if (isFirstRun()) {
    showSetupWizard();
  } else {
    await launchWiki();
  }

  createTray(() => mainWindow);
});

app.on("window-all-closed", () => {
  // Keep running in the tray; quit only via tray menu or Cmd+Q
});

app.on("before-quit", () => {
  isQuitting = true;
  stopServer();
  destroyTray();
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else if (isFirstRun()) {
    showSetupWizard();
  } else {
    launchWiki();
  }
});

// ── IPC handlers ────────────────────────────────────────────────────────

ipcMain.handle(
  "setup:start",
  async (
    event,
    params: { name: string; username: string; password: string },
  ) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;

    try {
      await runSetup(params, window);
      window.webContents.send("setup:complete");

      // Transition to wiki view after a brief pause
      setTimeout(async () => {
        window.close();
        await launchWiki();
      }, 1500);
    } catch (error: any) {
      console.error("[setup] error:", error);
      window.webContents.send("setup:error", error.message || "Setup failed");
    }
  },
);

// ── Setup wizard window ─────────────────────────────────────────────────

function showSetupWizard(): void {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 580,
    resizable: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: "window",
    icon: join(app.getAppPath(), "build", "icon.png"),
    webPreferences: {
      preload: join(app.getAppPath(), "dist", "src", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${VITE_DEV_SERVER_URL}index.html`);
  } else {
    mainWindow.loadFile(join(app.getAppPath(), "renderer", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Wiki window ─────────────────────────────────────────────────────────

async function launchWiki(): Promise<void> {
  refreshLocalSettings();
  await runSchemaUpdate();
  await startServer();
  await autoLogin();

  mainWindow = new BrowserWindow({
    width: 1152,
    height: 864,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 15 },
    title: "whoami",
    icon: join(app.getAppPath(), "build", "icon.png"),
    webPreferences: {
      preload: join(app.getAppPath(), "dist", "src", "preload-navbar.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Use a WebContentsView to render the wiki
  wikiView = new WebContentsView();
  mainWindow.contentView.addChildView(wikiView);

  // Fill the window, leaving space for the navbar
  const navbarHeight = 44;

  const resizeView = () => {
    if (!mainWindow || !wikiView) return;
    const { width, height } = mainWindow.getContentBounds();
    wikiView.setBounds({
      x: 0,
      y: navbarHeight,
      width,
      height: height - navbarHeight,
    });
  };

  // When DevTools is docked, the navbar viewport shrinks but
  // getContentBounds() still returns the full window width.
  // Read the actual viewport width so the wiki view doesn't cover DevTools.
  const adjustViewForDevTools = () => {
    if (!mainWindow || !wikiView) return;
    mainWindow.webContents
      .executeJavaScript("document.documentElement.clientWidth")
      .then((viewportWidth: number) => {
        if (!mainWindow || !wikiView) return;
        const { height } = mainWindow.getContentBounds();
        wikiView.setBounds({
          x: 0,
          y: navbarHeight,
          width: viewportWidth,
          height: height - navbarHeight,
        });
      })
      .catch(() => {});
  };

  mainWindow.on("resize", () => {
    resizeView();
    if (mainWindow?.webContents.isDevToolsOpened()) {
      adjustViewForDevTools();
    }
  });
  resizeView();

  mainWindow.webContents.on("devtools-opened", () => {
    setTimeout(adjustViewForDevTools, 100);
  });
  mainWindow.webContents.on("devtools-closed", resizeView);

  // Update window title and navbar based on wiki page
  wikiView.webContents.on("page-title-updated", (_event, title) => {
    // Strip " - whoami" suffix if present
    const clean = title.replace(/\s*[-–—]\s*whoami$/, "");
    mainWindow?.setTitle(clean || "whoami");
    mainWindow?.webContents.send("navbar:title-update", clean || "whoami");
  });

  // Open external links in the system browser
  wikiView.webContents.setWindowOpenHandler(({ url }) => {
    const serverUrl = getServerUrl();
    if (!url.startsWith(serverUrl)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "deny" }; // Navigate in-place instead
  });

  // Handle navigation to keep everything in the same view
  wikiView.webContents.on("will-navigate", (event, url) => {
    const serverUrl = getServerUrl();
    if (!url.startsWith(serverUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Load the navbar
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${VITE_DEV_SERVER_URL}user-interface.html`);
  } else {
    mainWindow.loadFile(
      join(app.getAppPath(), "renderer", "user-interface.html"),
    );
  }

  wikiView.webContents.loadURL(getServerUrl());

  // Send navigation state to navbar on every navigation
  const sendNavigationState = () => {
    if (!wikiView || !mainWindow) return;
    mainWindow.webContents.send("navbar:navigation-state", {
      canGoBack: wikiView.webContents.canGoBack(),
      canGoForward: wikiView.webContents.canGoForward(),
    });
  };
  wikiView.webContents.on("did-navigate", sendNavigationState);
  wikiView.webContents.on("did-navigate-in-page", sendNavigationState);

  // Sync navbar dark mode with the wiki's theme preference.
  // Vector 2022 sets skin-theme-clientpref-{night,os} classes on <html>.
  // We map these to nativeTheme.themeSource so prefers-color-scheme
  // (and thus Tailwind's dark: variants) follows the wiki's choice.
  wikiView.webContents.on("console-message", (_event, _level, message) => {
    if (!message.startsWith("__theme:")) return;
    const theme = message.slice("__theme:".length);
    if (theme === "dark" || theme === "light" || theme === "system") {
      nativeTheme.themeSource = theme;
    }
  });

  wikiView.webContents.on("did-finish-load", () => {
    wikiView?.webContents
      .executeJavaScript(
        `(function() {
        function getTheme() {
          const cl = document.documentElement.classList;
          if (cl.contains('skin-theme-clientpref-night')) return 'dark';
          if (cl.contains('skin-theme-clientpref-os')) return 'system';
          return 'light';
        }
        console.log('__theme:' + getTheme());
        new MutationObserver(() => console.log('__theme:' + getTheme()))
          .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      })()`,
      )
      .catch(() => {});
  });

  // Navbar IPC handlers
  const onGoBack = () => wikiView?.webContents.goBack();
  const onGoForward = () => wikiView?.webContents.goForward();
  const onOpenSettings = () => {
    if (mainWindow && wikiView) {
      mainWindow.contentView.removeChildView(wikiView);
    }
  };
  const onCloseSettings = () => {
    if (mainWindow && wikiView) {
      mainWindow.contentView.addChildView(wikiView);
      resizeView();
    }
  };
  const handleGetVersion = () => app.getVersion();
  ipcMain.on("navbar:go-back", onGoBack);
  ipcMain.on("navbar:go-forward", onGoForward);
  ipcMain.on("settings:open", onOpenSettings);
  ipcMain.on("settings:close", onCloseSettings);
  ipcMain.handle("app:get-version", handleGetVersion);

  // Keyboard shortcuts for navigation (on both navbar and wiki webContents)
  const handleKeyboardNav = (_event: Electron.Event, input: Electron.Input) => {
    if (!wikiView) return;
    if (input.meta && input.key === "[") {
      wikiView.webContents.goBack();
    } else if (input.meta && input.key === "]") {
      wikiView.webContents.goForward();
    } else if (input.meta && input.key === "r") {
      wikiView.webContents.reload();
    }
  };
  mainWindow.webContents.on("before-input-event", handleKeyboardNav);
  wikiView.webContents.on("before-input-event", handleKeyboardNav);

  // Hide instead of close so the app stays in the tray
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    ipcMain.removeListener("navbar:go-back", onGoBack);
    ipcMain.removeListener("navbar:go-forward", onGoForward);
    ipcMain.removeListener("settings:open", onOpenSettings);
    ipcMain.removeListener("settings:close", onCloseSettings);
    ipcMain.removeHandler("app:get-version");
    mainWindow = null;
    wikiView = null;
    stopServer();
  });

  initAutoUpdater(mainWindow);
}
