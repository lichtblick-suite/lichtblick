// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { init as initSentry } from "@sentry/electron";
import { contextBridge, ipcRenderer } from "electron";
import { machineIdSync } from "node-machine-id";
import os from "os";

import type { OsContext, OsContextForwardedEvent } from "@foxglove-studio/app/OsContext";
import { NetworkInterface } from "@foxglove-studio/app/OsContext";
import { APP_NAME, APP_VERSION } from "@foxglove-studio/app/constants";
import { PreloaderSockets } from "@foxglove/electron-socket/preloader";
import Logger from "@foxglove/log";

import LocalFileStorage from "./LocalFileStorage";

const log = Logger.getLogger(__filename);

log.info(`${APP_NAME} ${APP_VERSION}`);
log.info(`initializing preloader, argv="${window.process.argv.join(" ")}"`);

// Load opt-out settings for crash reporting and telemetry
const [allowCrashReporting, allowTelemetry] = getTelemetrySettings();
if (allowCrashReporting && typeof process.env.SENTRY_DSN === "string") {
  log.debug("initializing Sentry in preload");
  initSentry({
    dsn: process.env.SENTRY_DSN,
    autoSessionTracking: true,
    release: "studio@" + APP_VERSION,
  });
}

type IpcListener = (ev: unknown, ...args: unknown[]) => void;
const menuClickListeners = new Map<string, IpcListener>();

// Initialize the RPC channel for electron-socket asynchronously
PreloaderSockets.Create();

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
    ipcRenderer.invoke("load-pending-files");
  },
  { once: true },
);

const localFileStorage = new LocalFileStorage();

const ctx: OsContext = {
  platform: process.platform,
  pid: process.pid,
  handleToolbarDoubleClick() {
    ipcRenderer.send("window.toolbar-double-clicked");
  },
  addIpcEventListener(eventName: OsContextForwardedEvent, handler: () => void) {
    ipcRenderer.on(eventName, () => handler());
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
    if (listener === undefined) {
      return;
    }
    menuClickListeners.delete(name);
    ipcRenderer.off("menu.click-input-source", listener);
    await ipcRenderer.invoke("menu.remove-input-source", name);
  },

  isCrashReportingEnabled: (): boolean => allowCrashReporting,
  isTelemetryEnabled: (): boolean => allowTelemetry,

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
  getMachineId: (): string => {
    return machineIdSync();
  },
  getAppVersion: (): string => {
    return APP_VERSION;
  },

  getDeepLinks: (): string[] => {
    return window.process.argv.filter((arg) => arg.startsWith("foxglove://"));
  },

  // Context bridge cannot expose "classes" only exposes functions
  // We use .bind to attach the localFileStorage instance as _this_ to the function
  storage: {
    list: localFileStorage.list.bind(localFileStorage),
    all: localFileStorage.all.bind(localFileStorage),
    get: localFileStorage.get.bind(localFileStorage),
    put: localFileStorage.put.bind(localFileStorage),
    delete: localFileStorage.delete.bind(localFileStorage),
  },
};

// NOTE: Context Bridge imposes a number of limitations around how objects move between the context
// and the outside world. These restrictions impact what the api surface can expose and how.
//
// i.e.: returning a class instance doesn't work because prototypes do not survive the boundary
contextBridge.exposeInMainWorld("ctxbridge", ctx); // poorly named - expose to renderer

// Load telemetry opt-out settings from window.process.argv
function getTelemetrySettings(): [crashReportingEnabled: boolean, telemetryEnabled: boolean] {
  const argv = window.process.argv;
  const crashReportingEnabled = Boolean(
    parseInt(argv.find((arg) => arg.indexOf("--allowCrashReporting=") === 0)?.split("=")[1] ?? "0"),
  );
  const telemetryEnabled = Boolean(
    parseInt(argv.find((arg) => arg.indexOf("--allowTelemetry=") === 0)?.split("=")[1] ?? "0"),
  );
  return [crashReportingEnabled, telemetryEnabled];
}
