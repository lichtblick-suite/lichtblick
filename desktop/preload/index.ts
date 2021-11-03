// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { init as initSentry } from "@sentry/electron";
import { contextBridge, ipcRenderer } from "electron";
import os from "os";
import { join as pathJoin } from "path";

import { PreloaderSockets } from "@foxglove/electron-socket/preloader";
import Logger from "@foxglove/log";
import { NetworkInterface, OsContext } from "@foxglove/studio-base/src/OsContext";

import pkgInfo from "../../package.json";
import { Desktop, ForwardedMenuEvent, NativeMenuBridge, Storage } from "../common/types";
import LocalFileStorage from "./LocalFileStorage";
import { getExtensions, loadExtension, installExtension, uninstallExtension } from "./extensions";

const log = Logger.getLogger(__filename);

log.debug(`Start Preload`);
log.info(`${pkgInfo.productName} ${pkgInfo.version}`);
log.info(`initializing preloader, argv="${window.process.argv.join(" ")}"`);

window.onerror = (ev) => {
  console.error(ev);
};

// Load opt-out settings for crash reporting and telemetry
const [allowCrashReporting] = getTelemetrySettings();
if (allowCrashReporting && typeof process.env.SENTRY_DSN === "string") {
  log.debug("initializing Sentry in preload");
  initSentry({
    dsn: process.env.SENTRY_DSN,
    autoSessionTracking: true,
    release: `${process.env.SENTRY_PROJECT}@${pkgInfo.version}`,
    // Remove the default breadbrumbs integration - it does not accurately track breadcrumbs and
    // creates more noise than benefit.
    integrations: (integrations) => {
      return integrations.filter((integration) => {
        return integration.name !== "Breadcrumbs";
      });
    },
    ignoreErrors: ["ResizeObserver loop limit exceeded"],
  });
}

type IpcListener = (ev: unknown, ...args: unknown[]) => void;
const menuClickListeners = new Map<string, IpcListener>();

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
    return pkgInfo.version;
  },
};

const desktopBridge: Desktop = {
  async setRepresentedFilename(path: string | undefined) {
    await ipcRenderer.invoke("setRepresentedFilename", path);
  },
  async updateNativeColorScheme() {
    await ipcRenderer.invoke("updateNativeColorScheme");
  },
  getDeepLinks(): string[] {
    return window.process.argv.filter((arg) => arg.startsWith("foxglove://"));
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
    ipcRenderer.on(eventName, () => handler());
  },
  removeIpcEventListener(eventName: ForwardedMenuEvent, handler: () => void) {
    ipcRenderer.off(eventName, () => handler());
  },
  async menuAddInputSource(name: string, handler: () => void) {
    if (menuClickListeners.has(name)) {
      throw new Error(`Menu input source ${name} already exists`);
    }

    const listener: IpcListener = (_ev, ...args) => {
      if (args[0] === name) {
        handler();
      }
    };

    menuClickListeners.set(name, listener);
    ipcRenderer.on("menu.click-input-source", listener);
    await ipcRenderer.invoke("menu.add-input-source", name);
  },
  async menuRemoveInputSource(name: string) {
    const listener = menuClickListeners.get(name);
    if (listener == undefined) {
      return;
    }
    menuClickListeners.delete(name);
    ipcRenderer.off("menu.click-input-source", listener);
    await ipcRenderer.invoke("menu.remove-input-source", name);
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
contextBridge.exposeInMainWorld("allowCrashReporting", allowCrashReporting);
contextBridge.exposeInMainWorld("desktopBridge", desktopBridge);

// Load telemetry opt-out settings from window.process.argv
function getTelemetrySettings(): [crashReportingEnabled: boolean] {
  const argv = window.process.argv;
  const crashReportingEnabled = Boolean(
    parseInt(argv.find((arg) => arg.indexOf("--allowCrashReporting=") === 0)?.split("=")[1] ?? "0"),
  );
  return [crashReportingEnabled];
}

log.debug(`End Preload`);
