// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/testing-library";

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ImageView from "./index";

export default {
  title: "panels/ImageView",
  component: ImageView,
};

export const NoTopic: StoryObj = {
  render: () => (
    <PanelSetup>
      <ImageView />
    </PanelSetup>
  ),
};

export const WithSettings: StoryObj = {
  render: () => (
    <PanelSetup includeSettings>
      <ImageView />
    </PanelSetup>
  ),
  parameters: { colorScheme: "light" },
};

export const TopicButNoDataSource: StoryObj = {
  render: () => (
    <PanelSetup>
      <ImageView overrideConfig={{ ...ImageView.defaultConfig, cameraTopic: "a_topic" }} />
    </PanelSetup>
  ),
};

export const TopicButNoDataSourceHovered: StoryObj = {
  render: () => (
    <PanelSetup>
      <ImageView overrideConfig={{ ...ImageView.defaultConfig, cameraTopic: "a_topic" }} />
    </PanelSetup>
  ),
  parameters: { colorScheme: "dark" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    userEvent.hover(await canvas.findByTestId(/panel-mouseenter-container/));
  },
};

export const TopicButNoDataSourceHoveredLight: StoryObj = {
  ...TopicButNoDataSourceHovered,
  parameters: { colorScheme: "light" },
};
