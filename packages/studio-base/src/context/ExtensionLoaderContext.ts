// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export interface ExtensionDetail {
  name: string;
  source: string;
}

export interface ExtensionLoader {
  getExtensions(): Promise<ExtensionDetail[]>;
}

const ExtensionLoaderContext = createContext<ExtensionLoader | undefined>(undefined);

export function useExtensionLoader(): ExtensionLoader {
  const extensionLoader = useContext(ExtensionLoaderContext);
  if (extensionLoader == undefined) {
    throw new Error("An ExtensionLoaderContext provider is required to useExtensionLoader");
  }
  return extensionLoader;
}

export default ExtensionLoaderContext;
