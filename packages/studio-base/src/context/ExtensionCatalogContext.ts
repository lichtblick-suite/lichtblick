// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useGuaranteedContext } from "@lichtblick/hooks";
import {
  ExtensionPanelRegistration,
  Immutable,
  RegisterMessageConverterArgs,
} from "@lichtblick/studio";
import { TopicAliasFunctions } from "@lichtblick/studio-base/players/TopicAliasingPlayer/TopicAliasingPlayer";
import { ExtensionInfo, ExtensionNamespace } from "@lichtblick/studio-base/types/Extensions";
import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

export type RegisteredPanel = {
  extensionName: string;
  extensionNamespace?: ExtensionNamespace;
  registration: ExtensionPanelRegistration;
};

export type ExtensionCatalog = Immutable<{
  downloadExtension: (url: string) => Promise<Uint8Array>;
  installExtension: (
    namespace: ExtensionNamespace,
    foxeFileData: Uint8Array,
  ) => Promise<ExtensionInfo>;
  refreshExtensions: () => Promise<void>;
  uninstallExtension: (namespace: ExtensionNamespace, id: string) => Promise<void>;

  installedExtensions: undefined | ExtensionInfo[];
  installedPanels: undefined | Record<string, RegisteredPanel>;
  installedMessageConverters: undefined | RegisterMessageConverterArgs<unknown>[];
  installedTopicAliasFunctions: undefined | TopicAliasFunctions;
}>;

export const ExtensionCatalogContext = createContext<undefined | StoreApi<ExtensionCatalog>>(
  undefined,
);

export function useExtensionCatalog<T>(selector: (registry: ExtensionCatalog) => T): T {
  const context = useGuaranteedContext(ExtensionCatalogContext);
  return useStore(context, selector);
}
