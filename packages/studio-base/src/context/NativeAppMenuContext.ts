// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export type NativeAppMenuEvent =
  | "open"
  | "open-file"
  | "open-connection"
  | "open-demo"
  | "open-help-about"
  | "open-help-docs"
  | "open-help-general"
  | "open-help-slack";

type Handler = () => void;
type UnregisterFn = () => void;

export interface INativeAppMenu {
  addFileEntry(name: string, handler: Handler): void;
  removeFileEntry(name: string): void;

  on(name: NativeAppMenuEvent, handler: Handler): UnregisterFn | undefined;
}

const NativeAppMenuContext = createContext<INativeAppMenu | undefined>(undefined);
NativeAppMenuContext.displayName = "NativeAppMenuContext";

export function useNativeAppMenu(): INativeAppMenu | undefined {
  return useContext(NativeAppMenuContext);
}

export default NativeAppMenuContext;
