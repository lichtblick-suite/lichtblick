// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { contextBridge, ipcRenderer } from "electron";
import os from "os";
import { join as pathJoin } from "path";

import { PreloaderSockets } from "@foxglove/electron-socket/preloader";
import Logger from "@foxglove/log";
import { NetworkInterface, OsContext } from "@foxglove/studio-base/src/OsContext";

import LocalFileStorage from "./LocalFileStorage";
import { getExtensions, loadExtension, installExtension, uninstallExtension } from "./extensions";
import { decodeRendererArg } from "../common/rendererArgs";
import {
  Desktop,
  ForwardedMenuEvent,
  ForwardedWindowEvent,
  NativeMenuBridge,
  Storage,
} from "../common/types";
import { FOXGLOVE_PRODUCT_NAME, FOXGLOVE_PRODUCT_VERSION } from "../common/webpackDefines";

export function main(): void {
  const log = Logger.getLogger(__filename);

  log.debug(`Start Preload`);
  log.info(`${FOXGLOVE_PRODUCT_NAME} ${FOXGLOVE_PRODUCT_VERSION}`);
  log.info(`initializing preloader, argv="${window.process.argv.join(" ")}"`);

  window.onerror = (ev) => {
    console.error(ev);
  };

  // Initialize the RPC channel for electron-socket asynchronously
  PreloaderSockets.Create().catch((err) => {
    log.error("Failed to initialize preloader sockets", err);
  });

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      // This input element receives generated dom events from main thread to inject File objects
      // See the comments in desktop/index.ts regarding this feature
      const input = document.createElement("input");
      input.setAttribute("hidden", "true");
      input.setAttribute("type", "file");
      input.setAttribute("id", "electron-open-file-input");
      document.body.appendChild(input);

      // let main know we are ready to accept open-file requests
      void ipcRenderer.invoke("load-pending-files");
    },
    { once: true },
  );

  const localFileStorage = new LocalFileStorage();

  const ctx: OsContext = {
    platform: process.platform,
    pid: process.pid,

    // Environment queries
    getEnvVar: (envVar: string) => process.env[envVar],
    getHostname: os.hostname,
    getNetworkInterfaces: (): NetworkInterface[] => {
      const output: NetworkInterface[] = [];
      const ifaces = os.networkInterfaces();
      for (const name in ifaces) {
        const iface = ifaces[name];
        if (iface == undefined) {
          continue;
        }
        for (const info of iface) {
          output.push({ name, ...info, cidr: info.cidr ?? undefined });
        }
      }
      return output;
    },
    getAppVersion: (): string => {
      return FOXGLOVE_PRODUCT_VERSION;
    },
  };

  // Keep track of maximized state in the preload script because the initial ipc event sent from main
  // may occur before the app is fully rendered.
  let isMaximized = false;
  ipcRenderer.on("maximize", () => (isMaximized = true));
  ipcRenderer.on("unmaximize", () => (isMaximized = false));

  const desktopBridge: Desktop = {
    addIpcEventListener(eventName: ForwardedWindowEvent, handler: () => void) {
      ipcRenderer.on(eventName, handler);
      return () => {
        ipcRenderer.off(eventName, handler);
      };
    },
    async setRepresentedFilename(path: string | undefined) {
      await ipcRenderer.invoke("setRepresentedFilename", path);
    },
    async updateNativeColorScheme() {
      await ipcRenderer.invoke("updateNativeColorScheme");
    },
    async updateLanguage() {
      await ipcRenderer.invoke("updateLanguage");
    },
    getDeepLinks(): string[] {
      return decodeRendererArg("deepLinks", window.process.argv) ?? [];
    },
    async getExtensions() {
      const homePath = (await ipcRenderer.invoke("getHomePath")) as string;
      const userExtensionRoot = pathJoin(homePath, ".foxglove-studio", "extensions");
      const userExtensions = await getExtensions(userExtensionRoot);
      return userExtensions;
    },
    async loadExtension(id: string) {
      const homePath = (await ipcRenderer.invoke("getHomePath")) as string;
      const userExtensionRoot = pathJoin(homePath, ".foxglove-studio", "extensions");
      return await loadExtension(id, userExtensionRoot);
    },
    async installExtension(foxeFileData: Uint8Array) {
      const homePath = (await ipcRenderer.invoke("getHomePath")) as string;
      const userExtensionRoot = pathJoin(homePath, ".foxglove-studio", "extensions");
      return await installExtension(foxeFileData, userExtensionRoot);
    },
    async uninstallExtension(id: string): Promise<boolean> {
      const homePath = (await ipcRenderer.invoke("getHomePath")) as string;
      const userExtensionRoot = pathJoin(homePath, ".foxglove-studio", "extensions");
      return await uninstallExtension(id, userExtensionRoot);
    },
    handleTitleBarDoubleClick() {
      ipcRenderer.send("titleBarDoubleClicked");
    },
    isMaximized() {
      return isMaximized;
    },
    minimizeWindow() {
      ipcRenderer.send("minimizeWindow");
    },
    maximizeWindow() {
      ipcRenderer.send("maximizeWindow");
    },
    unmaximizeWindow() {
      ipcRenderer.send("unmaximizeWindow");
    },
    closeWindow() {
      ipcRenderer.send("closeWindow");
    },
    reloadWindow() {
      ipcRenderer.send("reloadMainWindow");
    },
  };

  const storageBridge: Storage = {
    // Context bridge cannot expose "classes" only exposes functions
    // We use .bind to attach the localFileStorage instance as _this_ to the function
    list: localFileStorage.list.bind(localFileStorage),
    all: localFileStorage.all.bind(localFileStorage),
    get: localFileStorage.get.bind(localFileStorage),
    put: localFileStorage.put.bind(localFileStorage),
    delete: localFileStorage.delete.bind(localFileStorage),
  };

  const menuBridge: NativeMenuBridge = {
    addIpcEventListener(eventName: ForwardedMenuEvent, handler: () => void) {
      ipcRenderer.on(eventName, handler);

      // We use an unregister handler return value approach because the bridge interface wraps
      // the handler function that render provides making it impossible for renderer to provide the
      // same function reference to `.off`.
      //
      // https://www.electronjs.org/docs/latest/api/context-bridge#parameter--error--return-type-support
      return () => {
        ipcRenderer.off(eventName, handler);
      };
    },
  };

  // NOTE: Context Bridge imposes a number of limitations around how objects move between the context
  // and the renderer. These restrictions impact what the api surface can expose and how.
  //
  // exposeInMainWorld is poorly named - it exposes the object to the renderer
  //
  // i.e.: returning a class instance doesn't work because prototypes do not survive the boundary
  contextBridge.exposeInMainWorld("ctxbridge", ctx);
  contextBridge.exposeInMainWorld("menuBridge", menuBridge);
  contextBridge.exposeInMainWorld("storageBridge", storageBridge);
  contextBridge.exposeInMainWorld("desktopBridge", desktopBridge);

  log.debug(`End Preload`);
}
