// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export type NativeAppMenuEvent =
  | "open-preferences"
  | "open-keyboard-shortcuts"
  | "open-message-path-syntax-help"
  | "open-welcome-layout"
  | "undo"
  | "redo";

type Handler = () => void;

export interface NativeAppMenu {
  addFileEntry(name: string, handler: Handler): void;
  removeFileEntry(name: string): void;

  on(name: NativeAppMenuEvent, handler: Handler): void;
  off(name: NativeAppMenuEvent, handler: Handler): void;
}

const NativeAppMenuContext = createContext<NativeAppMenu | undefined>(undefined);

export function useNativeAppMenu(): NativeAppMenu | undefined {
  return useContext(NativeAppMenuContext);
}

export default NativeAppMenuContext;
