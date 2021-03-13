// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Events that are forwarded from the main process and can be listened to using ctxbridge.addIpcEventListener
export type OsContextForwardedEvent =
  | "enter-full-screen"
  | "leave-full-screen"
  | "open-preferences"
  | "open-keyboard-shortcuts";

/** OsContext is exposed over the electron Context Bridge */
export interface OsContext {
  // See Node.js process.platform
  platform: string;

  handleToolbarDoubleClick(): void;

  // Events from the native window are available in the main process but not the renderer, so we forward them through the bridge.
  addIpcEventListener(eventName: OsContextForwardedEvent, handler: () => void): void;

  // Manage file menu input source menu items
  menuAddInputSource(name: string, handler: () => void): Promise<void>;
  menuRemoveInputSource(name: string): Promise<void>;
}

type GlobalWithCtx = typeof global & {
  ctxbridge?: OsContext;
};

/** Global singleton of the OsContext provided by the bridge */
export const OsContextSingleton = (global as GlobalWithCtx).ctxbridge;
