// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Events that are forwarded from the main process
export type ForwardedMenuEvent =
  | "open"
  | "open-file"
  | "open-connection"
  | "open-demo"
  | "open-help-about"
  | "open-help-docs"
  | "open-help-general";

export type ForwardedWindowEvent =
  | "enter-full-screen"
  | "leave-full-screen"
  | "maximize"
  | "unmaximize";

/** Registering an event listener returns a function that will un-register the listener */
export type UnregisterFn = () => void;

interface NativeMenuBridge {
  /**
   * Events from the native window are available in the main process but not the renderer, so we
   * forward them through the bridge.
   *
   * Return a function to remove the registered event handler.
   *
   * NOTE: We use an unregister function return value because the preload <-> renderer bridge
   * intercepts the function. This changes the reference value of the _handler_ function and breaks
   * the conventional event emitter API of using `.off(event, handler)` to unregister an event
   * handler since the handler function that renderer would provided will get wrapped and won't
   * resolve to the same instance as the one in the `.on` call.
   *
   * https://www.electronjs.org/docs/latest/api/context-bridge#parameter--error--return-type-support
   */
  addIpcEventListener(eventName: ForwardedMenuEvent, handler: () => void): UnregisterFn;
}

// Items suitable for storage
type StorageContent = string | Uint8Array;

interface Storage {
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

type DesktopExtension = {
  id: string;
  packageJson: unknown;
  directory: string;
  readme: string;
  changelog: string;
};

type DesktopLayout = {
  layoutJson: unknown;
  from: string;
};

export type CLIFlags = Readonly<Record<string, string>>;

export type LoadedExtension = {
  buffer?: Uint8Array;
  raw: string;
};

/**
 * Secure credential keys accepted by the main-process credential store. Only the local Agent LLM
 * key (one revisioned base record) and per-profile keys exist; there is no other secret type.
 */
export const SECURE_CREDENTIAL_KEYS = ["agent.llmApiKey"] as const;

export type SecureCredentialKey =
  | (typeof SECURE_CREDENTIAL_KEYS)[number]
  | `agent.profile.${string}.llmApiKey`;

export type SecureCredentialGetResult =
  | {
      ok: true;
      value: string | undefined;
      code?: "insecure-backend";
    }
  | { ok: false; code: "backend-unavailable" };

export type SecureCredentialSetResult =
  | { ok: true }
  | { ok: false; code: "backend-unavailable" | "insecure-backend" };

export type SecureCredentialSetManyEntry = {
  expectedRevision?: string;
  key: SecureCredentialKey;
  value: string;
};

export type SecureCredentialSetManyResult =
  | { ok: true }
  | {
      ok: false;
      code: "backend-unavailable" | "insecure-backend" | "invalid-request" | "revision-conflict";
    };

export function isSecureCredentialKey(value: unknown): value is SecureCredentialKey {
  return (
    typeof value === "string" &&
    ((SECURE_CREDENTIAL_KEYS as readonly string[]).includes(value) ||
      /^agent\.profile\.[A-Za-z0-9-]{1,64}\.llmApiKey$/.test(value))
  );
}

interface Desktop {
  /** https://www.electronjs.org/docs/tutorial/represented-file */
  setRepresentedFilename(path: string | undefined): Promise<void>;

  addIpcEventListener(eventName: ForwardedWindowEvent, handler: () => void): UnregisterFn;

  /**
   * Notify the app that the color scheme setting has changed and the native theme may need to be
   * updated.
   */
  updateNativeColorScheme(): Promise<void>;

  // Get an array of deep links provided on app launch
  getDeepLinks: () => string[];

  // Reset the deep links. After reset, `getDeepLinks` will return an empty array.
  resetDeepLinks: () => void;

  // Get an array of available extensions and parsed package.json files
  getExtensions: () => Promise<DesktopExtension[]>;

  // Load the source code for an extension
  loadExtension: (id: string) => Promise<LoadedExtension>;

  // Fetch default layouts from local folder
  fetchLayouts: () => Promise<DesktopLayout[]>;

  // Install a Lichtblick extension (.foxe file) locally. The extension id is returned
  installExtension: (foxeFileData: Uint8Array) => Promise<DesktopExtension>;

  // Uninstall an extension. Returns true if the extension was found and uninstalled, or false if it
  // was not found (i.e. already uninstalled)
  uninstallExtension: (id: string) => Promise<boolean>;

  // Get CLI flags passed when the app was launched
  getCLIFlags: () => Promise<CLIFlags>;

  // Trust boundary: installed extensions run as full-privilege code in this same renderer realm
  // and are intentionally trusted at the same level as built-in application code. These APIs
  // protect credentials at rest; they are not an isolation boundary against installed extensions.
  getSecureCredential: (key: SecureCredentialKey) => Promise<SecureCredentialGetResult>;
  setSecureCredential: (
    key: SecureCredentialKey,
    value: string,
  ) => Promise<SecureCredentialSetResult>;
  setManySecureCredentials: (
    entries: SecureCredentialSetManyEntry[],
  ) => Promise<SecureCredentialSetManyResult>;
  deleteSecureCredential: (key: SecureCredentialKey) => Promise<void>;

  /** Handle a double-click on the custom title bar */
  handleTitleBarDoubleClick(): void;

  isMaximized(): boolean;
  minimizeWindow(): void;
  maximizeWindow(): void;
  unmaximizeWindow(): void;
  closeWindow(): void;
  reloadWindow(): void;

  /** Notify the app that the language setting has been changed */
  updateLanguage(): void;
}

export type { Desktop, DesktopExtension, DesktopLayout, NativeMenuBridge, Storage, StorageContent };
