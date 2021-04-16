// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Allow console logs in this file
/* eslint-disable no-restricted-syntax */

import "colors";
import { addBreadcrumb, captureException, init as initSentry } from "@sentry/electron";
import { app, BrowserWindow, ipcMain, Menu, session, nativeTheme } from "electron";
import installExtension, {
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS,
} from "electron-devtools-installer";
import { autoUpdater } from "electron-updater";
import fs from "fs";

import { APP_NAME, APP_VERSION, APP_HOMEPAGE } from "@foxglove-studio/app/constants";
import Logger from "@foxglove/log";

import StudioWindow from "./StudioWindow";
import { installMenuInterface } from "./menu";
import { getTelemetrySettings } from "./telemetry";

const log = Logger.getLogger(__filename);

log.info(`${APP_NAME} ${APP_VERSION}`);

const isProduction = process.env.NODE_ENV === "production";

// Suppress Electron Security Warning in development
// See the comment for the webSecurity setting on browser window
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = isProduction ? "false" : "true";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// Load opt-out settings for crash reporting and telemetry
const [allowCrashReporting] = getTelemetrySettings();
if (allowCrashReporting && typeof process.env.SENTRY_DSN === "string") {
  log.info("initializing Sentry in renderer");
  initSentry({
    dsn: process.env.SENTRY_DSN,
    autoSessionTracking: true,
    release: "studio@" + APP_VERSION,
  });
}

if (!app.isDefaultProtocolClient("foxglove")) {
  if (!app.setAsDefaultProtocolClient("foxglove")) {
    log.warn("Could not set app as handler for foxglove://");
  }
}

// files our app should open - either from user double-click on a supported fileAssociation
// or command line arguments. For now limit to .bag file arguments
// Note: in dev we launch electron with `electron .webpack` so we need to filter out things that are not files
const filesToOpen: string[] = process.argv.slice(1).filter((item) => {
  // Anything that isn't a file or directory will throw, we filter those out too
  try {
    return fs.statSync(item).isFile();
  } catch (err) {
    // ignore
  }
  return false;
});
app.on("open-file", (_ev, filePath) => {
  filesToOpen.push(filePath);
});

// works on osx - even when app is closed
// tho it is a bit strange since it isn't clear when this runs...
const openUrls: string[] = [];
app.on("open-url", (ev, url) => {
  if (!url.startsWith("foxglove://")) {
    return;
  }

  ev.preventDefault();

  if (app.isReady()) {
    if (url.startsWith("foxglove://")) {
      new StudioWindow([url]);
    }
  } else {
    openUrls.push(url);
  }
});

// support preload lookups for the user data path
ipcMain.handle("getUserDataPath", () => {
  return app.getPath("userData");
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  nativeTheme.themeSource = "dark";

  // Only stable builds check for automatic updates
  if (process.env.NODE_ENV !== "production") {
    log.info("Automatic updates disabled (development environment)");
  } else if (/-(dev|nightly)/.test(APP_VERSION)) {
    log.info("Automatic updates disabled (development build)");
  } else {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      captureException(err);
    });
  }

  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: APP_VERSION,
    version: process.platform,
    copyright: undefined,
    website: APP_HOMEPAGE,
    iconPath: undefined,
  });

  if (!isProduction) {
    console.group("Installing Chrome extensions for development...");
    // Extension installation sometimes gets stuck between the download step and the extension loading step, for unknown reasons.
    // So don't wait indefinitely for installation to complete.
    let finished = false;
    await Promise.race([
      Promise.allSettled([
        installExtension(REACT_DEVELOPER_TOOLS),
        (process.env.REDUX_DEVTOOLS ?? "") !== "" ? installExtension(REDUX_DEVTOOLS) : null,
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
      if (app.dock != undefined) {
        // This fails when opening the app from a packaged DMG.
        app.dock.setIcon("resources/icon/icon.png");
      }
    } catch (error) {
      console.error("Unable to set icon", error);
    }
  }

  // Content Security Policy
  // See: https://www.electronjs.org/docs/tutorial/security
  const contentSecurityPolicy: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'unsafe-inline' 'unsafe-eval'`,
    "worker-src": `'self' blob:`,
    "style-src": "'self' 'unsafe-inline'",
    "connect-src": "'self' ws: wss: http: https:", // Required for rosbridge connections
    "font-src": "'self' data:",
    "img-src": "'self' data: https:",
  };

  if (allowCrashReporting) {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      // Log web requests as crash reporting breadcrumbs
      addBreadcrumb({
        type: "http",
        category: "request",
        timestamp: details.timestamp / 1000.0,
        data: { url: details.url, method: details.method },
      });
      callback({});
    });
  }

  // Set default http headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = new URL(details.url);
    const responseHeaders = { ...details.responseHeaders };

    // Log web responses as crash reporting breadcrumbs
    if (allowCrashReporting) {
      addBreadcrumb({
        type: "http",
        category: "response",
        timestamp: details.timestamp / 1000.0,
        data: {
          url: details.url,
          method: details.method,
          status_code: details.statusCode,
          reason: details.statusLine,
        },
      });
    }

    // don't set CSP for internal URLs
    if (!["chrome-extension:", "devtools:"].includes(url.protocol)) {
      responseHeaders["Content-Security-Policy"] = [
        Object.entries(contentSecurityPolicy)
          .map(([key, val]) => `${key} ${val}`)
          .join("; "),
      ];
    }

    callback({ responseHeaders });
  });

  // When we change the focused window we switc the app menu so actions go to the correct window
  app.on("browser-window-focus", (_ev, browserWindow) => {
    const studioWindow = StudioWindow.fromWebContentsId(browserWindow.webContents.id);
    if (studioWindow) {
      Menu.setApplicationMenu(studioWindow.getMenu());
    }
  });

  // Our app has support for working with _File_ instances in the renderer. This avoids extra copies
  // while reading files and lets the renderer seek/read as necessary using all the browser
  // primitives for _File_ instances.
  //
  // Unfortunately Electron does not provide a way to create or send _File_ instances to the renderer.
  // To avoid sending the data over our context bridge, we use a _hack_.
  // Via the debugger we _inject_ a DOM event to set the files of an <input> element.
  const inputElementId = "electron-open-file-input";
  async function loadFilesToOpen(browserWindow: BrowserWindow) {
    const debug = browserWindow.webContents.debugger;
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

  // indicates the preloader has setup the file input used to inject which files to open
  let preloaderFileInputIsReady = false;

  // This handles user dropping files on the doc icon or double clicking a file when the app
  // is already open.
  //
  // The open-file handler registered earlier will handle adding the file to filesToOpen
  app.on("open-file", async (_ev) => {
    if (preloaderFileInputIsReady) {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        await loadFilesToOpen(focusedWindow);
      }
    }
  });

  // preload will tell us when it is ready to process the pending open file requests
  ipcMain.handle("load-pending-files", async (ev) => {
    const browserWindow = BrowserWindow.fromId(ev.sender.id);
    if (browserWindow) {
      await loadFilesToOpen(browserWindow);
    }
    preloaderFileInputIsReady = true;
  });

  // This event handler must be added after the "ready" event fires
  // (see https://github.com/electron/electron-quick-start/pull/382)
  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      new StudioWindow();
    }
  });

  installMenuInterface();

  const argv = process.argv;
  const deepLinks = argv.filter((arg) => arg.startsWith("foxglove://"));
  new StudioWindow([...deepLinks, ...openUrls]);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
