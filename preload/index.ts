// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { init as initSentry } from "@sentry/electron";
import { contextBridge, ipcRenderer } from "electron";
import { machineIdSync } from "node-machine-id";
import os from "os";

import type { OsContext, OsContextForwardedEvent } from "@foxglove-studio/app/OsContext";
import { NetworkInterface } from "@foxglove-studio/app/OsContext";
import { PreloaderSockets } from "@foxglove/electron-socket/preloader";

import appPackage from "../package.json";
import LocalFileStorage from "./LocalFileStorage";

if (typeof process.env.SENTRY_DSN === "string") {
  initSentry({ dsn: process.env.SENTRY_DSN });
}

type IpcListener = (ev: unknown, ...args: unknown[]) => void;
const menuClickListeners = new Map<string, IpcListener>();

// Initialize the RPC channel for electron-socket
PreloaderSockets.Create();

window.addEventListener("DOMContentLoaded", () => {
  // This input element receives generated dom events from main thread to inject File objects
  // See the comments in desktop/index.ts regarding this feature
  const input = document.createElement("input");
  input.setAttribute("hidden", "true");
  input.setAttribute("type", "file");
  input.setAttribute("id", "electron-open-file-input");
  document.body.appendChild(input);
});

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

    await ipcRenderer.invoke("menu.add-input-source", name);
    menuClickListeners.set(name, listener);
    ipcRenderer.on("menu.click-input-source", listener);
  },
  async menuRemoveInputSource(name: string) {
    const listener = menuClickListeners.get(name);
    if (listener === undefined) {
      return;
    }
    menuClickListeners.delete(name);
    ipcRenderer.off("menu.click-input-source", listener);
    ipcRenderer.invoke("menu.remove-input-source", name);
  },

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
    return appPackage.version;
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
const { exposeInMainWorld: exposeToRenderer } = contextBridge; // poorly named
exposeToRenderer("ctxbridge", ctx);
