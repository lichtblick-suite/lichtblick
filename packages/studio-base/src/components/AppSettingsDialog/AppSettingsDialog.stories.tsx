// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryFn, StoryObj } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";
import * as _ from "lodash-es";

import { ExtensionInfo, ExtensionLoader } from "@foxglove/studio-base";
import ExtensionMarketplaceContext, {
  ExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";
import ExtensionCatalogProvider from "@foxglove/studio-base/providers/ExtensionCatalogProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import { AppSettingsDialog } from "./AppSettingsDialog";

const installedExtensions: ExtensionInfo[] = _.range(1, 10).map((index) => ({
  id: "publisher.storyextension",
  name: "privatestoryextension",
  qualifiedName: "storyextension",
  displayName: `Private Extension Name ${index + 1}`,
  description: "Private extension sample description",
  publisher: "Private Publisher",
  homepage: "https://foxglove.dev/",
  license: "MIT",
  version: `1.${index}`,
  keywords: ["storybook", "testing"],
  namespace: index % 2 === 0 ? "local" : "org",
}));

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

function Wrapper(StoryComponent: StoryFn): JSX.Element {
  return (
    <WorkspaceContextProvider>
      <ExtensionCatalogProvider loaders={[MockExtensionLoader]}>
        <ExtensionMarketplaceContext.Provider value={MockExtensionMarketplace}>
          <StoryComponent />
        </ExtensionMarketplaceContext.Provider>
      </ExtensionCatalogProvider>
    </WorkspaceContextProvider>
  );
}

export default {
  title: "components/AppSettingsDialog",
  component: AppSettingsDialog,
  parameters: { colorScheme: "light" },
  decorators: [Wrapper],
};

export const Default: StoryObj = {
  render: () => {
    return <AppSettingsDialog open />;
  },
};

export const DefaultChinese: StoryObj = {
  ...Default,
  parameters: { forceLanguage: "zh" },
};

export const DefaultJapanese: StoryObj = {
  ...Default,
  parameters: { forceLanguage: "ja" },
};

export const ChangingLanguage: StoryObj = {
  render: function Story() {
    return <AppSettingsDialog open />;
  },

  play: async () => {
    const { click, keyboard } = userEvent.setup();
    const input = await screen.findByText("English", { exact: false });
    await click(input);

    await keyboard("中文");
    const item = await screen.findByText("中文", { exact: false });
    await click(item);
  },
};

export const General: StoryObj = {
  render: () => {
    return <AppSettingsDialog open activeTab="general" />;
  },
};

export const GeneralChinese: StoryObj = {
  ...General,
  parameters: { forceLanguage: "zh" },
};

export const GeneralJapanese: StoryObj = {
  ...General,
  parameters: { forceLanguage: "ja" },
};

export const Privacy: StoryObj = {
  render: () => {
    return <AppSettingsDialog open activeTab="privacy" />;
  },
};

export const PrivacyChinese: StoryObj = {
  ...Privacy,
  parameters: { forceLanguage: "zh" },
};

export const PrivacyJapanese: StoryObj = {
  ...Privacy,
  parameters: { forceLanguage: "ja" },
};

export const Extensions: StoryObj = {
  render: () => {
    return <AppSettingsDialog open activeTab="extensions" />;
  },
};

export const ExtensionsChinese: StoryObj = {
  ...Extensions,
  parameters: { forceLanguage: "zh" },
};

export const ExtensionsJapanese: StoryObj = {
  ...Extensions,
  parameters: { forceLanguage: "ja" },
};

export const Experimental: StoryObj = {
  render: () => {
    return <AppSettingsDialog open activeTab="experimental-features" />;
  },
};

export const ExperimentalChinese: StoryObj = {
  ...Experimental,
  parameters: { forceLanguage: "zh" },
};

export const ExperimentalJapanese: StoryObj = {
  ...Experimental,
  parameters: { forceLanguage: "ja" },
};

export const About: StoryObj = {
  render: () => {
    return <AppSettingsDialog open activeTab="about" />;
  },
};

export const AboutChinese: StoryObj = {
  ...About,
  parameters: { forceLanguage: "zh" },
};

export const AboutJapanese: StoryObj = {
  ...About,
  parameters: { forceLanguage: "ja" },
};
