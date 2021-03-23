// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BrowserWindow, ipcMain, Menu, MenuItem } from "electron";

import { simulateUserClick } from "./simulateUserClick";

// Install handlers for ipc menu add and remove events
// These handlers allow for the preload/renderer to manage the list of "File Open ..." items.
export function installMenuInterface(): void {
  ipcMain.removeHandler("menu.add-input-source");
  ipcMain.handle("menu.add-input-source", (_ev: unknown, ...args) => {
    const name = args[0];
    if (typeof name !== "string") {
      throw new Error("menu.add-input-source argument 'name' must be a string");
    }

    const appMenu = Menu.getApplicationMenu();
    const fileMenu = appMenu?.getMenuItemById("fileMenu");
    if (!fileMenu) {
      return;
    }

    const existingItem = fileMenu.submenu?.getMenuItemById(name);
    // If the item already exists, we can silently return
    // The existing click handler will support the new item since they have the same name
    if (existingItem) {
      existingItem.visible = true;
      Menu.setApplicationMenu(appMenu);
      return;
    }

    const idx = fileMenu.submenu?.items.findIndex((item) => {
      return item.role === "close" || item.role === "quit";
    });
    if (idx === undefined || idx < 0) {
      return;
    }

    fileMenu.submenu?.insert(
      idx,
      new MenuItem({
        label: `Open ${name}`,
        id: name,
        click: async () => {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (!focusedWindow) {
            return;
          }

          await simulateUserClick(focusedWindow);
          focusedWindow.webContents.send("menu.click-input-source", name);
        },
      }),
    );
    Menu.setApplicationMenu(appMenu);
  });

  ipcMain.removeHandler("menu.remove-input-source");
  ipcMain.handle("menu.remove-input-source", (_ev: unknown, ...args) => {
    const name = args[0];
    if (typeof name !== "string") {
      throw new Error("menu.add-input-source argument 'name' must be a string");
    }

    const appMenu = Menu.getApplicationMenu();
    const fileMenu = appMenu?.getMenuItemById("fileMenu");

    const menuItem = fileMenu?.submenu?.getMenuItemById(name);
    if (menuItem) {
      menuItem.visible = false;
    }

    Menu.setApplicationMenu(appMenu);
  });
}
