// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

import { ExtensionPanelRegistration } from "@foxglove/studio";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { ExtensionInfo, ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

export type RegisteredPanel = {
  extensionName: string;
  namespace?: string;
  registration: ExtensionPanelRegistration;
};

export type ExtensionRegistry = {
  downloadExtension: (url: string) => Promise<Uint8Array>;
  installExtension: (
    namespace: ExtensionNamespace,
    foxeFileData: Uint8Array,
  ) => Promise<ExtensionInfo>;
  loadExtension(id: string): Promise<string>;
  refreshExtensions: () => Promise<void>;
  registeredExtensions: undefined | ExtensionInfo[];
  registeredPanels: undefined | Record<string, RegisteredPanel>;
  uninstallExtension: (namespace: ExtensionNamespace, id: string) => Promise<void>;
};

export const ExtensionRegistryContext = createContext<undefined | StoreApi<ExtensionRegistry>>(
  undefined,
);

export function useExtensionRegistry<T>(
  selector: (registry: ExtensionRegistry) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(ExtensionRegistryContext);
  return useStore(context, selector, equalityFn);
}
