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

import { ExtensionDetails } from "@foxglove/studio-base/components/ExtensionDetails";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import ExtensionMarketplaceContext, {
  ExtensionMarketplace,
  ExtensionMarketplaceDetail,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";
import ExtensionRegistryProvider from "@foxglove/studio-base/providers/ExtensionRegistryProvider";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

export default {
  title: "components/ExtensionDetails",
  component: ExtensionDetails,
};

const MockExtensionLoader: ExtensionLoader = {
  namespace: "local",
  getExtensions: async () => [],
  loadExtension: async (_id: string) => "",
  installExtension: async (_foxeFileData: Uint8Array) => {
    throw new Error("MockExtensionLoader cannot install extensions");
  },
  uninstallExtension: async (_id: string) => undefined,
};

const MockExtensionMarketplace: ExtensionMarketplace = {
  getAvailableExtensions: async () => [],
  getMarkdown: async (url: string) =>
    `# Markdown
Mock markdown rendering for URL [${url}](${url}).`,
};

const extension: ExtensionMarketplaceDetail = {
  id: "publisher.storyextension",
  name: "Extension Name",
  description: "Extension sample description",
  qualifiedName: "Qualified Extension Name",
  publisher: "Publisher",
  homepage: "https://foxglove.dev/",
  license: "MIT",
  version: "1.2.10",
  readme: "https://foxglove.dev/storyextension/readme",
  changelog: "https://foxglove.dev/storyextension/changelog",
  foxe: "https://foxglove.dev/storyextension/extension.foxe",
  keywords: ["storybook", "testing"],
  time: {
    modified: "2021-05-19T21:37:40.166Z",
    created: "2012-04-17T00:38:04.350Z",
    "0.0.2": "2012-04-17T00:38:05.679Z",
    "2.1.0": "2021-05-19T21:37:38.037Z",
  },
};

export function Details(): JSX.Element {
  const [config] = useState(() => makeMockAppConfiguration());

  return (
    <AppConfigurationContext.Provider value={config}>
      <ExtensionRegistryProvider loaders={[MockExtensionLoader]}>
        <ExtensionMarketplaceContext.Provider value={MockExtensionMarketplace}>
          <ExtensionDetails extension={extension} onClose={() => {}} installed={false} />
        </ExtensionMarketplaceContext.Provider>
      </ExtensionRegistryProvider>
    </AppConfigurationContext.Provider>
  );
}
