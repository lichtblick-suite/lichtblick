// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Events that are forwarded from the main process and can be listened to using ctxbridge.addIpcEventListener
export type OsContextForwardedEvent =
  | "enter-full-screen"
  | "leave-full-screen"
  | "open-preferences"
  | "open-keyboard-shortcuts"
  | "open-message-path-syntax-help"
  | "open-welcome-layout"
  | "undo"
  | "redo";

export type StorageContent = string | Uint8Array;

export interface Storage {
  // list items in the datastore
  list(datastore: string): Promise<string[]>;
  // get all the items in the datastore
  all(datastore: string): Promise<StorageContent[]>;
  // get a single item from the datastore
  get(
    datastore: string,
    key: string,
    options?: { encoding: undefined },
  ): Promise<Uint8Array | undefined>;
  get(datastore: string, key: string, options: { encoding: "utf8" }): Promise<string | undefined>;
  // put a single item into the datastore
  // This will replace any existing item with the same key
  put(datastore: string, key: string, value: StorageContent): Promise<void>;
  // remove an item from the datastore
  delete(datastore: string, key: string): Promise<void>;
}

export interface NetworkInterface {
  name: string;
  family: "IPv4" | "IPv6";
  internal: boolean;
  address: string;
  cidr?: string;
  mac: string;
  netmask: string;
}

/** OsContext is exposed over the electron Context Bridge */
export interface OsContext {
  // See Node.js process.platform
  platform: string;

  // The process id of this application
  pid: number;

  handleToolbarDoubleClick: () => void;

  // Events from the native window are available in the main process but not the renderer, so we forward them through the bridge.
  addIpcEventListener(eventName: OsContextForwardedEvent, handler: () => void): void;

  // Manage file menu input source menu items
  menuAddInputSource(name: string, handler: () => void): Promise<void>;
  menuRemoveInputSource(name: string): Promise<void>;

  // Retrieve an environment variable
  getEnvVar: (envVar: string) => string | undefined;
  // Get the operating system hostname
  getHostname: () => string;
  // Get a listing for every network interface discovered on the system
  getNetworkInterfaces: () => NetworkInterface[];
  // Get a unique identifier for the system from the operating system
  getMachineId: () => string;
  // Get the version string from package.json
  getAppVersion: () => string;

  // file backed key/value storage
  storage: Storage;
}
