// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryFn, StoryObj } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";

import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import { AppSettingsDialog } from "./AppSettingsDialog";

function Wrapper(StoryComponent: StoryFn): JSX.Element {
  return (
    <WorkspaceContextProvider>
      <StoryComponent />
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
