// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";

import { ExtensionInfo, ExtensionLoader } from "@foxglove/studio-base";
import { PreferencesDialog } from "@foxglove/studio-base/components/AppBar/Preferences";
import ExtensionMarketplaceContext, {
  ExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";
import ExtensionCatalogProvider from "@foxglove/studio-base/providers/ExtensionCatalogProvider";

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

function Wrapper(StoryComponent: Story): JSX.Element {
  return (
    <ExtensionCatalogProvider loaders={[MockExtensionLoader]}>
      <ExtensionMarketplaceContext.Provider value={MockExtensionMarketplace}>
        <StoryComponent />
      </ExtensionMarketplaceContext.Provider>
    </ExtensionCatalogProvider>
  );
}

export default {
  title: "components/PreferencesDialog",
  component: PreferencesDialog,
  parameters: { colorScheme: "light" },
  decorators: [Wrapper],
};

export function Default(): JSX.Element {
  return <PreferencesDialog open />;
}

export function General(): JSX.Element {
  return <PreferencesDialog open activeTab="general" />;
}

export function Privacy(): JSX.Element {
  return <PreferencesDialog open activeTab="privacy" />;
}

export function Extensions(): JSX.Element {
  return <PreferencesDialog open activeTab="extensions" />;
}

export function Experimental(): JSX.Element {
  return <PreferencesDialog open activeTab="experimental-features" />;
}

export function About(): JSX.Element {
  return <PreferencesDialog open activeTab="about" />;
}
