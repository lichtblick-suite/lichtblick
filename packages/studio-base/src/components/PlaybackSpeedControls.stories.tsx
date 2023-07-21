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

import { Meta, StoryObj } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import PlaybackSpeedControls from "@foxglove/studio-base/components/PlaybackSpeedControls";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";

const CAPABILITIES = ["setSpeed", "playbackControl"];

export default {
  title: "components/PlaybackSpeedControls",
  component: PlaybackSpeedControls,
  parameters: { colorScheme: "dark" },
  decorators: [
    (WrappedStory, { args }) => (
      <MockCurrentLayoutProvider>
        <MockMessagePipelineProvider {...args}>
          <div style={{ padding: 20, paddingTop: 300 }}>
            <WrappedStory />
          </div>
        </MockMessagePipelineProvider>
      </MockCurrentLayoutProvider>
    ),
  ],
  play: async () => {
    const el = await screen.findByTestId<HTMLInputElement>("PlaybackSpeedControls-Dropdown");
    if (!el.disabled) {
      await userEvent.click(el);
    }
  },
} satisfies Meta<typeof MockMessagePipelineProvider>;

type Story = StoryObj<typeof MockMessagePipelineProvider>;

export const WithoutSpeedCapability: Story = {
  name: "without speed capability",
};

export const WithoutASpeedFromThePlayer: Story = {
  name: "without a speed from the player",
  args: { capabilities: CAPABILITIES, activeData: { speed: undefined } },
};

export const WithASpeed: Story = {
  name: "with a speed",
  args: { capabilities: CAPABILITIES },
};

export const WithAVerySmallSpeed: Story = {
  name: "with a very small speed",
  args: { capabilities: CAPABILITIES, activeData: { speed: 0.01 } },
};
