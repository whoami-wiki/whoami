import { app, Tray, Menu, nativeImage, type BrowserWindow } from "electron";
import { join } from "node:path";

let tray: Tray | null = null;

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const icon = nativeImage.createFromPath(
    join(app.getAppPath(), "assets", "iconTemplate.png"),
  );
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("Whoami Wiki");

  const menu = Menu.buildFromTemplate([{ label: "Quit whoami", role: "quit" }]);

  tray.on("click", () => {
    const win = getWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  tray.on("right-click", () => {
    tray?.popUpContextMenu(menu);
  });

  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
