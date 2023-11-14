// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";

import { ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

export type ExtensionMarketplaceDetail = {
  id: string;
  name: string;
  qualifiedName: string;
  namespace?: ExtensionNamespace;
  description: string;
  publisher: string;
  homepage: string;
  license: string;
  version: string;
  readme?: string;
  changelog?: string;
  sha256sum?: string;
  foxe?: string;
  keywords?: string[];
  time?: Record<string, string>;
};

export interface ExtensionMarketplace {
  getAvailableExtensions(): Promise<ExtensionMarketplaceDetail[]>;
  getMarkdown(url: string): Promise<string>;
}

const ExtensionMarketplaceContext = createContext<ExtensionMarketplace | undefined>(undefined);
ExtensionMarketplaceContext.displayName = "ExtensionMarketplaceContext";

export default ExtensionMarketplaceContext;
