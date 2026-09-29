// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";

import { registerMemoryMetricsHandler } from "./memoryMetrics";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    // Always shown, even in CI: CI runs this under Xvfb (a real, if virtual, display - see
    // e2e-benchmark.yml), so there's no need to hide the window there. A hidden (`show: false`)
    // BrowserWindow never gets a compositor/paint pipeline at all, so `requestAnimationFrame`
    // never fires for it - which hangs the Plot panel's pauseFrame/resumeFrame handshake
    // (TimeBasedChart's `onFinishRender`) forever, since it waits on a rAF callback that will
    // never come. `backgroundThrottling: false` below only stops *timer* throttling; it doesn't
    // restore rAF for a window that's never shown.
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
      // Without this, Chromium throttles rAF/timers for non-visible (e.g. minimized/occluded)
      // windows, which would skew frame-time/memory benchmark results.
      backgroundThrottling: false,
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

// `app.quit()` (used by Playwright's `electronApplication.close()`) waits for each window's
// `beforeunload`/`unload` events to round-trip through the renderer before actually closing it.
// The synthetic benchmark players keep the renderer's event loop continuously busy producing
// messages, which can delay that round-trip by tens of seconds. Since this is a throwaway
// benchmark shell (not a real app with unsaved state to protect), force-destroy windows on quit
// to skip the beforeunload/unload handshake entirely and shut down promptly.
app.on("before-quit", () => {
  for (const mainWindow of BrowserWindow.getAllWindows()) {
    mainWindow.destroy();
  }
});
