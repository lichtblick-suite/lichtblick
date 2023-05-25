// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

import { useGuaranteedContext } from "@foxglove/hooks";
import { ExtensionPanelRegistration, RegisterMessageConverterArgs } from "@foxglove/studio";
import { ExtensionInfo, ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

export type RegisteredPanel = {
  extensionName: string;
  extensionNamespace?: ExtensionNamespace;
  registration: ExtensionPanelRegistration;
};

export type ExtensionCatalog = {
  downloadExtension: (url: string) => Promise<Uint8Array>;
  installExtension: (
    namespace: ExtensionNamespace,
    foxeFileData: Uint8Array,
  ) => Promise<ExtensionInfo>;
  refreshExtensions: () => Promise<void>;
  uninstallExtension: (namespace: ExtensionNamespace, id: string) => Promise<void>;

  installedExtensions: undefined | ExtensionInfo[];
  installedPanels: undefined | Record<string, RegisteredPanel>;
  installedMessageConverters: undefined | readonly RegisterMessageConverterArgs<unknown>[];
};

export const ExtensionCatalogContext = createContext<undefined | StoreApi<ExtensionCatalog>>(
  undefined,
);

export function useExtensionCatalog<T>(
  selector: (registry: ExtensionCatalog) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(ExtensionCatalogContext);
  return useStore(context, selector, equalityFn);
}
