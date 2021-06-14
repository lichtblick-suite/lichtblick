// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export type ExtensionInfo = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  publisher: string;
  homepage: string;
  license: string;
  version: string;
  keywords: string[];
};

export interface ExtensionLoader {
  // get a list of installed extensions
  getExtensions(): Promise<ExtensionInfo[]>;

  // load the source code for a specific extension
  loadExtension(id: string): Promise<string>;

  // download a .foxe file from a web URL and store it in memory. The resulting binary data can be
  // passed into `installExtension`
  downloadExtension(url: string): Promise<Uint8Array>;

  // install extension contained within the file data
  installExtension(foxeFileData: Uint8Array): Promise<ExtensionInfo>;

  // uninstall extension with id
  // return true if the extension was found and uninstalled, false if not found
  uninstallExtension(id: string): Promise<boolean>;
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
