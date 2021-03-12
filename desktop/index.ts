// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Allow console logs in this file
/* eslint-disable no-restricted-syntax */

import "colors";
import { captureException, init as initSentry } from "@sentry/electron";
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Menu,
  MenuItemConstructorOptions,
  session,
  shell,
  systemPreferences,
} from "electron";
import installExtension, {
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS,
} from "electron-devtools-installer";
import { autoUpdater } from "electron-updater";
import path from "path";

import packageJson from "../package.json";
import { installMenuInterface } from "./menu";
import type { OsContextWindowEvent } from "@foxglove-studio/app/OsContext";
import colors from "@foxglove-studio/app/styles/colors.module.scss";

if (typeof process.env.SENTRY_DSN === "string") {
  initSentry({ dsn: process.env.SENTRY_DSN });
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// files our app should open - either from user double-click on a supported fileAssociation
// or command line arguments
const filesToOpen: string[] = process.argv.slice(1);
app.on("open-file", (_ev, filePath) => {
  filesToOpen.push(filePath);
});

const isMac = process.platform === "darwin";
const isProduction = process.env.NODE_ENV === "production";

async function createWindow(): Promise<void> {
  const preloadPath = path.join(app.getAppPath(), "main", "preload.js");
  const rendererPath = MAIN_WINDOW_WEBPACK_ENTRY;

  const windowOptions: BrowserWindowConstructorOptions = {
    height: 800,
    width: 1200,
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
    },
    backgroundColor: colors.background,
  };
  if (isMac) {
    windowOptions.titleBarStyle = "hiddenInset";
  }
  const mainWindow = new BrowserWindow(windowOptions);

  app.setAboutPanelOptions({
    applicationName: packageJson.productName,
    applicationVersion: packageJson.version,
    version: process.platform,
    copyright: undefined,
    website: packageJson.homepage,
    iconPath: undefined,
  });

  // Forward full screen events to the renderer
  const forwardWindowEvent = (name: OsContextWindowEvent) => {
    // @ts-ignore https://github.com/microsoft/TypeScript/issues/14107
    mainWindow.addListener(name, () => {
      mainWindow.webContents.send(name);
    });
  };
  forwardWindowEvent("enter-full-screen");
  forwardWindowEvent("leave-full-screen");

  const appMenuTemplate: MenuItemConstructorOptions[] = [];

  if (isMac) {
    appMenuTemplate.push({
      role: "appMenu",
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  appMenuTemplate.push({
    role: "fileMenu",
    label: "File",
    id: "fileMenu",
    submenu: [isMac ? { role: "close" } : { role: "quit" }],
  });

  appMenuTemplate.push({
    role: "editMenu",
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" } as const,
            { role: "delete" } as const,
            { role: "selectAll" } as const,
          ]
        : [
            { role: "delete" } as const,
            { type: "separator" } as const,
            { role: "selectAll" } as const,
          ]),
    ],
  });

  appMenuTemplate.push({
    role: "viewMenu",
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  });

  appMenuTemplate.push({
    role: "help",
    submenu: [
      {
        label: "Learn More",
        click: async () => {
          await shell.openExternal("https://electronjs.org");
        },
      },
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenuTemplate));
  installMenuInterface();

  mainWindow.loadURL(rendererPath);

  if (!isProduction) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on("ipc-message", (_event: unknown, channel: string) => {
    if (channel === "window.toolbar-double-clicked") {
      const action: string =
        systemPreferences.getUserDefault("AppleActionOnDoubleClick", "string") || "Maximize";
      if (action === "Minimize") {
        mainWindow.minimize();
      } else if (action === "Maximize") {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
      } else {
        // "None"
      }
    }
  });

  // Our app has support for working with _File_ instances in the renderer. This avoids extra copies
  // while reading files and lets the renderer seek/read as necessary using all the browser
  // primavites for _File_ instances.
  //
  // Unfortunately Electron does not provide a way to create or send _File_ instances to the renderer.
  // To avoid sending the data over our context bridge, we use a _hack_.
  // Via the debugger we _inject_ a DOM event to set the files of an <input> element.
  const inputElementId = "electron-open-file-input";
  async function loadFilesToOpen() {
    const debug = mainWindow.webContents.debugger;
    try {
      debug.attach("1.1");
    } catch (err) {
      // debugger may already be attached
    }

    try {
      const documentRes = await debug.sendCommand("DOM.getDocument");
      const queryRes = await debug.sendCommand("DOM.querySelector", {
        nodeId: documentRes.root.nodeId,
        selector: `#${inputElementId}`,
      });
      await debug.sendCommand("DOM.setFileInputFiles", {
        nodeId: queryRes.nodeId,
        files: filesToOpen,
      });

      // clear the files once we've opened them
      filesToOpen.splice(0, filesToOpen.length);
    } finally {
      debug.detach();
    }
  }

  // This handles user dropping files on the doc icon or double clicking a file when the app
  // is already open.
  //
  // The open-file handler registered earlier will handle adding the file to filesToOpen
  app.on("open-file", async (_ev) => {
    await loadFilesToOpen();
  });

  // When the window content has loaded, the input is available, we can open our files now
  mainWindow.webContents.on("did-finish-load", () => {
    loadFilesToOpen();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    captureException(err);
  });

  if (!isProduction) {
    console.group("Installing Chrome extensions for development...");
    // Extension installation sometimes gets stuck between the download step and the extension loading step, for unknown reasons.
    // So don't wait indefinitely for installation to complete.
    let finished = false;
    await Promise.race([
      Promise.allSettled([
        installExtension(REACT_DEVELOPER_TOOLS),
        installExtension(REDUX_DEVTOOLS),
      ]).then((results) => {
        finished = true;
        console.log("Finished:", results);
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          if (!finished) {
            console.warn(
              "Warning: extension installation may be stuck; try relaunching electron or deleting its extensions directory. Continuing for now."
                .yellow,
            );
          }
          resolve();
        }, 5000);
      }),
    ]);
    console.groupEnd();

    // In development, we run with the pre-packaged Electron binary, so we need to manually set the Dock icon.
    try {
      // This fails when opening the app from a packaged DMG.
      app.dock.setIcon("resources/icon/icon.png");
    } catch (error) {
      console.error("Unable to set icon", error);
    }
  }

  // Content Security Policy
  // See: https://www.electronjs.org/docs/tutorial/security
  const contentSecurtiyPolicy: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'unsafe-inline' 'unsafe-eval'`,
    "worker-src": `'self' blob:`,
    "style-src": "'self' 'unsafe-inline'",
    "connect-src": "'self' ws: wss: http: https:", // Required for rosbridge connections
    "font-src": "'self' data:",
    "img-src": "'self' data:",
  };

  // Set default http headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = new URL(details.url);
    const responseHeaders = { ...details.responseHeaders };

    // don't set CSP for internal URLs
    if (!["chrome-extension:", "devtools:"].includes(url.protocol)) {
      responseHeaders["Content-Security-Policy"] = [
        Object.entries(contentSecurtiyPolicy)
          .map(([key, val]) => `${key} ${val}`)
          .join("; "),
      ];
    }

    callback({ responseHeaders });
  });

  // Create the main window
  createWindow();

  // This event handler must be added after the "ready" event fires
  // (see https://github.com/electron/electron-quick-start/pull/382)
  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  app.quit();
});
