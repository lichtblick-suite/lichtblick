// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useState } from "react";

import { ExtensionInfo, ExtensionLoader } from "@foxglove/studio-base";
import ExtensionsSidebar from "@foxglove/studio-base/components/ExtensionsSidebar";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import ExtensionMarketplaceContext, {
  ExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";
import ExtensionCatalogProvider from "@foxglove/studio-base/providers/ExtensionCatalogProvider";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

export default {
  title: "components/ExtensionsSidebar",
  component: ExtensionsSidebar,
};

const installedExtensions: ExtensionInfo[] = [
  {
    id: "publisher.storyextension",
    name: "privatestoryextension",
    qualifiedName: "storyextension",
    displayName: "Private Extension Name",
    description: "Private extension sample description",
    publisher: "Private Publisher",
    homepage: "https://foxglove.dev/",
    license: "MIT",
    version: "1.2.10",
    keywords: ["storybook", "testing"],
    namespace: "org",
  },
  {
    id: "publisher.storyextension",
    name: "storyextension",
    qualifiedName: "storyextension",
    displayName: "Extension Name",
    description: "Extension sample description",
    publisher: "Publisher",
    homepage: "https://foxglove.dev/",
    license: "MIT",
    version: "1.2.10",
    keywords: ["storybook", "testing"],
    namespace: "local",
  },
];

const marketplaceExtensions: ExtensionInfo[] = [
  {
    id: "publisher.storyextension",
    name: "storyextension",
    qualifiedName: "storyextension",
    displayName: "Extension Name",
    description: "Extension sample description",
    publisher: "Publisher",
    homepage: "https://foxglove.dev/",
    license: "MIT",
    version: "1.2.10",
    keywords: ["storybook", "testing"],
  },
];

const MockExtensionLoader: ExtensionLoader = {
  namespace: "local",
  getExtensions: async () => installedExtensions,
  loadExtension: async (_id: string) => "",
  installExtension: async (_foxeFileData: Uint8Array) => {
    throw new Error("MockExtensionLoader cannot install extensions");
  },
  uninstallExtension: async (_id: string) => undefined,
};

const MockExtensionMarketplace: ExtensionMarketplace = {
  getAvailableExtensions: async () => marketplaceExtensions,
  getMarkdown: async (url: string) => `# Markdown
Mock markdown rendering for URL [${url}](${url}).`,
};

export function Sidebar(): JSX.Element {
  const [config] = useState(() => makeMockAppConfiguration());

  return (
    <AppConfigurationContext.Provider value={config}>
      <ExtensionCatalogProvider loaders={[MockExtensionLoader]}>
        <ExtensionMarketplaceContext.Provider value={MockExtensionMarketplace}>
          <ExtensionsSidebar />
        </ExtensionMarketplaceContext.Provider>
      </ExtensionCatalogProvider>
    </AppConfigurationContext.Provider>
  );
}
