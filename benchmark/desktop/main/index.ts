// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";

import { registerMemoryMetricsHandler } from "./memoryMetrics";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: !process.env.CI,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  void mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

registerMemoryMetricsHandler(ipcMain, app);

app
  .whenReady()
  .then(createWindow)
  .catch((error: unknown) => {
    console.error("Failed to start Lichtblick benchmark desktop shell", error);
  });

app.on("window-all-closed", () => {
  app.quit();
});
