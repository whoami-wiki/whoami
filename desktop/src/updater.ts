import { autoUpdater } from 'electron-updater';
import { type BrowserWindow, dialog } from 'electron';

export function initAutoUpdater(window: BrowserWindow): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Update available: ${info.version}`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(window, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'It will be installed when you restart the app.',
      buttons: ['Restart Now', 'Later'],
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message);
  });

  autoUpdater.checkForUpdatesAndNotify();
}
