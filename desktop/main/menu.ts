// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ipcMain, Menu } from "electron";

import StudioWindow from "./StudioWindow";

// Install handlers for ipc menu add and remove events
// These handlers allow for the preload/renderer to manage the list of "File Open ..." items.
export function installMenuInterface(): void {
  ipcMain.removeHandler("menu.add-input-source");
  ipcMain.handle("menu.add-input-source", (ev, ...args) => {
    const name = args[0];
    if (typeof name !== "string") {
      throw new Error("menu.add-input-source argument 'name' must be a string");
    }

    const studioWindow = StudioWindow.fromWebContentsId(ev.sender.id);
    if (!studioWindow) {
      throw new Error(`Could not find window for id ${ev.sender.id}`);
    }

    studioWindow.addInputSource(name);
    if (studioWindow.getBrowserWindow().isFocused()) {
      Menu.setApplicationMenu(studioWindow.getMenu());
    }
  });

  ipcMain.removeHandler("menu.remove-input-source");
  ipcMain.handle("menu.remove-input-source", (ev, ...args) => {
    const name = args[0];
    if (typeof name !== "string") {
      throw new Error("menu.add-input-source argument 'name' must be a string");
    }

    const studioWindow = StudioWindow.fromWebContentsId(ev.sender.id);
    if (!studioWindow) {
      throw new Error(`Could not find window for id ${ev.sender.id}`);
    }

    studioWindow.removeInputSource(name);
    if (studioWindow.getBrowserWindow().isFocused()) {
      Menu.setApplicationMenu(studioWindow.getMenu());
    }
  });
}
