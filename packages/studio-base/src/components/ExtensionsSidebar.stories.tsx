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

import ExtensionsSidebar from "@foxglove/studio-base/components/ExtensionsSidebar";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import ExtensionLoaderContext, {
  ExtensionInfo,
  ExtensionLoader,
} from "@foxglove/studio-base/context/ExtensionLoaderContext";
import ExtensionMarketplaceContext, {
  ExtensionMarketplace,
  ExtensionMarketplaceDetail,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";
import { makeConfiguration } from "@foxglove/studio-base/util/makeConfiguration";

export default {
  title: "components/ExtensionsSidebar",
  component: ExtensionsSidebar,
};

const installedExtensions: ExtensionInfo[] = [
  {
    id: "publisher.storyextension",
    name: "storyextension",
    displayName: "Extension Name",
    description: "Extension sample description",
    publisher: "Publisher",
    homepage: "https://foxglove.dev/",
    license: "MIT",
    version: "1.2.10",
    keywords: ["storybook", "testing"],
  },
];

const marketplaceExtensions: ExtensionInfo[] = [
  {
    id: "publisher.storyextension",
    name: "storyextension",
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
  getExtensions: (): Promise<ExtensionInfo[]> => Promise.resolve(installedExtensions),
  loadExtension: (_id: string): Promise<string> => Promise.resolve(""),
  downloadExtension: (_url: string): Promise<Uint8Array> => Promise.resolve(new Uint8Array()),
  installExtension: (_foxeFileData: Uint8Array): Promise<ExtensionInfo> => {
    throw new Error("MockExtensionLoader cannot install extensions");
  },
  uninstallExtension: (_id: string): Promise<boolean> => Promise.resolve(false),
};

const MockExtensionMarketplace: ExtensionMarketplace = {
  getAvailableExtensions: (): Promise<ExtensionMarketplaceDetail[]> =>
    Promise.resolve(marketplaceExtensions),
  getMarkdown: (url: string): Promise<string> =>
    Promise.resolve(`# Markdown
Mock markdown rendering for URL [${url}](${url}).`),
};

export function Sidebar(): JSX.Element {
  const [config] = useState(() => makeConfiguration());

  return (
    <AppConfigurationContext.Provider value={config}>
      <ExtensionLoaderContext.Provider value={MockExtensionLoader}>
        <ExtensionMarketplaceContext.Provider value={MockExtensionMarketplace}>
          <ExtensionsSidebar />
        </ExtensionMarketplaceContext.Provider>
      </ExtensionLoaderContext.Provider>
    </AppConfigurationContext.Provider>
  );
}
