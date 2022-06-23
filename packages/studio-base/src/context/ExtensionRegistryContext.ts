// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { ExtensionPanelRegistration } from "@foxglove/studio";

export type RegisteredPanel = {
  extensionName: string;
  namespace?: string;
  registration: ExtensionPanelRegistration;
};

export interface ExtensionRegistry {
  // Get registered panel matching fullId
  getRegisteredPanel(fullId: string): RegisteredPanel | undefined;

  // Get a list of all registered panels
  getRegisteredPanels(): RegisteredPanel[];
}

const ExtensionRegistryContext = createContext<ExtensionRegistry | undefined>(undefined);
ExtensionRegistryContext.displayName = "ExtensionRegistryContext";

export function useExtensionRegistry(): ExtensionRegistry {
  const extensionRegistry = useContext(ExtensionRegistryContext);
  if (extensionRegistry == undefined) {
    throw new Error("An ExtensionRegistryContext provider is required to useExtensionRegistry");
  }
  return extensionRegistry;
}

export default ExtensionRegistryContext;
