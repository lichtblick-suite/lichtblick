// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  app,
  dialog,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Menu,
  MenuItemConstructorOptions,
  shell,
  MenuItem,
} from "electron";
import path from "path";

import Logger from "@foxglove/log";

import pkgInfo from "../../package.json";
import getDevModeIcon from "./getDevModeIcon";
import { simulateUserClick } from "./simulateUserClick";
import { getTelemetrySettings } from "./telemetry";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

const isMac = process.platform === "darwin";
const isProduction = process.env.NODE_ENV === "production";
const rendererPath = MAIN_WINDOW_WEBPACK_ENTRY;

const closeMenuItem: MenuItemConstructorOptions = isMac ? { role: "close" } : { role: "quit" };

const log = Logger.getLogger(__filename);

type ClearableMenu = Menu & { clear: () => void };

function newStudioWindow(deepLinks: string[] = []): BrowserWindow {
  const { crashReportingEnabled, telemetryEnabled } = getTelemetrySettings();

  const preloadPath = path.join(app.getAppPath(), "main", "preload.js");

  const windowOptions: BrowserWindowConstructorOptions = {
    height: 800,
    width: 1200,
    minWidth: 350,
    minHeight: 250,
    autoHideMenuBar: true,
    title: pkgInfo.productName,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
      nodeIntegration: false,
      additionalArguments: [
        `--allowCrashReporting=${crashReportingEnabled ? "1" : "0"}`,
        `--allowTelemetry=${telemetryEnabled ? "1" : "0"}`,
        ...deepLinks,
      ],
      // Disable webSecurity in development so we can make XML-RPC calls, load
      // remote data, etc. In production, the app is served from file:// URLs so
      // the Origin header is not sent, disabling the CORS
      // Access-Control-Allow-Origin check
      webSecurity: isProduction,
    },
  };
  if (!isProduction) {
    const devIcon = getDevModeIcon();
    if (devIcon) {
      windowOptions.icon = devIcon;
    }
  }

  const browserWindow = new BrowserWindow(windowOptions);

  // Forward full screen events to the renderer
  browserWindow.addListener("enter-full-screen", () =>
    browserWindow.webContents.send("enter-full-screen"),
  );

  browserWindow.addListener("leave-full-screen", () =>
    browserWindow.webContents.send("leave-full-screen"),
  );

  browserWindow.webContents.once("dom-ready", () => {
    if (!isProduction) {
      browserWindow.webContents.openDevTools();
    }
  });

  // Open all new windows in an external browser
  // Note: this API is supposed to be superseded by webContents.setWindowOpenHandler,
  // but using that causes the app to freeze when a new window is opened.
  browserWindow.webContents.on("new-window", (event, url) => {
    event.preventDefault();
    void shell.openExternal(url);
  });

  browserWindow.webContents.on("will-navigate", (event, reqUrl) => {
    // if the target url is not the same as our host then force open in a browser
    // URL.host includes the port - so this works for localhost servers vs webpack dev server
    const targetHost = new URL(reqUrl).host;
    const currentHost = new URL(browserWindow.webContents.getURL()).host;
    const isExternal = targetHost !== currentHost;
    if (isExternal) {
      event.preventDefault();
      void shell.openExternal(reqUrl);
    }
  });

  return browserWindow;
}

function buildMenu(browserWindow: BrowserWindow): Menu {
  const menuTemplate: MenuItemConstructorOptions[] = [];

  if (isMac) {
    menuTemplate.push({
      role: "appMenu",
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Preferences…",
          accelerator: "CommandOrControl+,",
          click: () => browserWindow.webContents.send("open-preferences"),
        },
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

  menuTemplate.push({
    role: "fileMenu",
    label: "File",
    id: "fileMenu",
    submenu: [
      {
        label: "New Window",
        click: () => {
          new StudioWindow().load();
        },
      },
      ...(isMac
        ? []
        : [
            { type: "separator" } as const,
            {
              label: "Preferences…",
              accelerator: "CommandOrControl+,",
              click: () => browserWindow.webContents.send("open-preferences"),
            } as const,
          ]),
      { type: "separator" },
      closeMenuItem,
    ],
  });

  menuTemplate.push({
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

  const showSharedWorkersMenu = () => {
    // Electron doesn't let us update dynamic menus when they are being opened, so just open a popup
    // context menu. This is ugly, but only for development anyway.
    // https://github.com/electron/electron/issues/528
    const workers = browserWindow.webContents.getAllSharedWorkers();
    Menu.buildFromTemplate(
      workers.length === 0
        ? [{ label: "No Shared Workers", enabled: false }]
        : workers.map(
            (worker) =>
              new MenuItem({
                label: worker.url,
                click() {
                  browserWindow.webContents.closeDevTools();
                  browserWindow.webContents.inspectSharedWorkerById(worker.id);
                },
              }),
          ),
    ).popup();
  };

  menuTemplate.push({
    role: "viewMenu",
    label: "View",
    submenu: [
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
      { type: "separator" },
      {
        label: "Advanced",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          {
            label: "Inspect Shared Worker…",
            click() {
              showSharedWorkersMenu();
            },
          },
        ],
      },
    ],
  });

  const showAboutDialog = () => {
    void dialog.showMessageBox(browserWindow, {
      type: "info",
      title: `About ${pkgInfo.productName}`,
      message: pkgInfo.productName,
      detail: `Version: ${pkgInfo.version}`,
    });
  };

  menuTemplate.push({
    role: "help",
    submenu: [
      {
        label: "Welcome",
        click: () => browserWindow.webContents.send("open-welcome-layout"),
      },
      {
        label: "Message path syntax",
        click: () => browserWindow.webContents.send("open-message-path-syntax-help"),
      },
      {
        label: "Keyboard shortcuts",
        accelerator: "CommandOrControl+/",
        click: () => browserWindow.webContents.send("open-keyboard-shortcuts"),
      },
      {
        label: "Learn more",
        click: async () => await shell.openExternal("https://foxglove.dev"),
      },
      { type: "separator" } as const,
      {
        label: "License",
        click: async () => await shell.openExternal("https://foxglove.dev/legal/studio-license"),
      },
      {
        label: "Privacy",
        click: async () => await shell.openExternal("https://foxglove.dev/legal/privacy"),
      },
      ...(isMac
        ? []
        : [
            { type: "separator" } as const,
            {
              label: "About",
              click() {
                showAboutDialog();
              },
            },
          ]),
    ],
  });

  return Menu.buildFromTemplate(menuTemplate);
}

class StudioWindow {
  // track windows by the web-contents id
  // The web contents id is most broadly available across IPC events and app handlers
  // BrowserWindow.id is not as available
  private static windowsByContentId = new Map<number, StudioWindow>();

  private _window: BrowserWindow;
  private _menu: Menu;

  private _inputSources = new Set<string>();

  constructor(deepLinks: string[] = []) {
    const browserWindow = newStudioWindow(deepLinks);
    this._window = browserWindow;
    this._menu = buildMenu(browserWindow);

    const id = browserWindow.webContents.id;

    log.info(`New Foxglove Studio window ${id}`);
    StudioWindow.windowsByContentId.set(id, this);

    // when a window closes and it is the current application menu, clear the input sources
    browserWindow.once("close", () => {
      if (Menu.getApplicationMenu() === this._menu) {
        const existingMenu = Menu.getApplicationMenu();
        const fileMenu = existingMenu?.getMenuItemById("fileMenu");
        // https://github.com/electron/electron/issues/8598
        (fileMenu?.submenu as ClearableMenu)?.clear();
        fileMenu?.submenu?.append(
          new MenuItem({
            label: "New Window",
            click: () => {
              new StudioWindow().load();
            },
          }),
        );

        fileMenu?.submenu?.append(
          new MenuItem({
            type: "separator",
          }),
        );

        fileMenu?.submenu?.append(new MenuItem(closeMenuItem));
        Menu.setApplicationMenu(existingMenu);
      }
    });
    browserWindow.once("closed", () => {
      StudioWindow.windowsByContentId.delete(id);
    });
  }

  load(): void {
    // load after setting windowsById so any ipc handlers with id lookup work
    log.info(`window.loadURL(${rendererPath})`);
    this._window
      .loadURL(rendererPath)
      .then(() => {
        log.info("window URL loaded");
      })
      .catch((err) => {
        log.error("loadURL error", err);
      });
  }

  addInputSource(name: string): void {
    this._inputSources.add(name);

    const fileMenu = this._menu.getMenuItemById("fileMenu");
    if (!fileMenu) {
      return;
    }

    const existingItem = fileMenu.submenu?.getMenuItemById(name);
    // If the item already exists, we can silently return
    // The existing click handler will support the new item since they have the same name
    if (existingItem) {
      existingItem.visible = true;
      return;
    }

    // build new file menu
    this.rebuildFileMenu(fileMenu);

    this._window.setMenu(this._menu);
  }

  removeInputSource(name: string): void {
    this._inputSources.delete(name);

    const fileMenu = this._menu?.getMenuItemById("fileMenu");
    if (!fileMenu) {
      return;
    }

    this.rebuildFileMenu(fileMenu);
    this._window.setMenu(this._menu);
  }

  getBrowserWindow(): BrowserWindow {
    return this._window;
  }

  getMenu(): Menu {
    return this._menu;
  }

  static fromWebContentsId(id: number): StudioWindow | undefined {
    return StudioWindow.windowsByContentId.get(id);
  }

  private rebuildFileMenu(fileMenu: MenuItem): void {
    const browserWindow = this._window;

    // https://github.com/electron/electron/issues/8598
    (fileMenu.submenu as ClearableMenu).clear();
    fileMenu.submenu?.items.splice(0, fileMenu.submenu.items.length);

    fileMenu.submenu?.append(
      new MenuItem({
        label: "New Window",
        click: () => {
          new StudioWindow().load();
        },
      }),
    );

    fileMenu.submenu?.append(
      new MenuItem({
        type: "separator",
      }),
    );

    for (const sourceName of this._inputSources) {
      fileMenu.submenu?.append(
        new MenuItem({
          label: `Open ${sourceName}`,
          click: async () => {
            await simulateUserClick(browserWindow);
            browserWindow.webContents.send("menu.click-input-source", sourceName);
          },
        }),
      );
    }

    if (!isMac) {
      fileMenu.submenu?.append(
        new MenuItem({
          type: "separator",
        }),
      );

      fileMenu.submenu?.append(
        new MenuItem({
          label: "Preferences…",
          accelerator: "CommandOrControl+,",
          click: () => browserWindow.webContents.send("open-preferences"),
        }),
      );
    }

    fileMenu.submenu?.append(
      new MenuItem({
        type: "separator",
      }),
    );

    fileMenu.submenu?.append(new MenuItem(closeMenuItem));
  }
}

export default StudioWindow;
