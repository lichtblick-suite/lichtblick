// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { range } from "lodash";

import { ExtensionInfo, ExtensionLoader } from "@foxglove/studio-base";
import ExtensionMarketplaceContext, {
  ExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";
import ExtensionCatalogProvider from "@foxglove/studio-base/providers/ExtensionCatalogProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import { PreferencesDialog } from "./PreferencesDialog";

const installedExtensions: ExtensionInfo[] = range(1, 10).map((index) => ({
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

function Wrapper(StoryComponent: Story): JSX.Element {
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
  title: "components/PreferencesDialog",
  component: PreferencesDialog,
  parameters: { colorScheme: "light" },
  decorators: [Wrapper],
};

export function Default(): JSX.Element {
  return <PreferencesDialog open />;
}
export const DefaultChinese = (): JSX.Element => <Default />;
DefaultChinese.parameters = { forceLanguage: "zh" };

export function ChangingLanguage(): JSX.Element {
  return <PreferencesDialog open />;
}
ChangingLanguage.play = async () => {
  const user = userEvent.setup();
  const input = await screen.findByText("English", { exact: false });
  await user.click(input);

  await userEvent.keyboard("中文");
  const item = await screen.findByText("中文", { exact: false });
  await user.click(item);
};

export function General(): JSX.Element {
  return <PreferencesDialog open activeTab="general" />;
}
export const GeneralChinese = (): JSX.Element => <General />;
GeneralChinese.parameters = { forceLanguage: "zh" };

export function Privacy(): JSX.Element {
  return <PreferencesDialog open activeTab="privacy" />;
}
export const PrivacyChinese = (): JSX.Element => <Privacy />;
PrivacyChinese.parameters = { forceLanguage: "zh" };

export function Extensions(): JSX.Element {
  return <PreferencesDialog open activeTab="extensions" />;
}
export const ExtensionsChinese = (): JSX.Element => <Extensions />;
ExtensionsChinese.parameters = { forceLanguage: "zh" };

export function Experimental(): JSX.Element {
  return <PreferencesDialog open activeTab="experimental-features" />;
}
export const ExperimentalChinese = (): JSX.Element => <Experimental />;
ExperimentalChinese.parameters = { forceLanguage: "zh" };

export function About(): JSX.Element {
  return <PreferencesDialog open activeTab="about" />;
}
export const AboutChinese = (): JSX.Element => <About />;
AboutChinese.parameters = { forceLanguage: "zh" };
