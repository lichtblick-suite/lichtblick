// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export type NativeAppMenuEvent =
  | "open-file"
  | "open-remote-file"
  | "open-sample-data"
  | "open-layouts"
  | "open-add-panel"
  | "open-panel-settings"
  | "open-variables"
  | "open-extensions"
  | "open-help"
  | "open-account"
  | "open-app-settings";

type Handler = () => void;

export interface INativeAppMenu {
  addFileEntry(name: string, handler: Handler): void;
  removeFileEntry(name: string): void;

  on(name: NativeAppMenuEvent, handler: Handler): void;
  off(name: NativeAppMenuEvent, handler: Handler): void;
}

const NativeAppMenuContext = createContext<INativeAppMenu | undefined>(undefined);
NativeAppMenuContext.displayName = "NativeAppMenuContext";

export function useNativeAppMenu(): INativeAppMenu | undefined {
  return useContext(NativeAppMenuContext);
}

export default NativeAppMenuContext;
