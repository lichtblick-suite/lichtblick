// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Meta, StoryFn, StoryObj } from "@storybook/react";
import { action } from "storybook/actions";

import MockMessagePipelineProvider, {
  MockMessagePipelineProps,
} from "@lichtblick/suite-base/components/MessagePipeline/MockMessagePipelineProvider";
import Stack from "@lichtblick/suite-base/components/Stack";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import { AppBar } from ".";
import { StorybookDecorator } from "./StorybookDecorator.stories";

export default {
  title: "components/AppBar",
  component: AppBar,
  decorators: [StorybookDecorator],
  args: {
    onMinimizeWindow: action("onMinimizeWindow"),
    onMaximizeWindow: action("onMaximizeWindow"),
    onUnmaximizeWindow: action("onUnmaximizeWindow"),
    onCloseWindow: action("onCloseWindow"),
  },
  parameters: { colorScheme: "both-column" },
} satisfies Meta<typeof AppBar>;

type Story = StoryObj<typeof AppBar>;

export const Default: Story = {};
export const DefaultChinese: Story = { parameters: { forceLanguage: "zh" } };
export const DefaultJapanese: Story = { parameters: { forceLanguage: "ja" } };

export const CustomWindowControls: Story = {
  args: { showCustomWindowControls: true },
};

export const CustomWindowControlsMaximized: Story = {
  args: { isMaximized: true, showCustomWindowControls: true },
};

export const CustomWindowControlsDragRegion: Story = {
  args: { showCustomWindowControls: true, debugDragRegion: true },
};

const Grid = (Story: StoryFn): React.JSX.Element => (
  <Stack overflowY="auto">
    <div style={{ display: "grid", gridTemplateColumns: "max-content auto", alignItems: "center" }}>
      <Story />
    </div>
  </Stack>
);

const alerts: MockMessagePipelineProps["alerts"] = [
  { severity: "error", message: "example error" },
  { severity: "warn", message: "example warn" },
];

export const PlayerStates: Story = {
  decorators: [
    (Story: StoryFn): React.JSX.Element => {
      const playerStates: (MockMessagePipelineProps & { label?: string })[] = [
        ...[
          PlayerPresence.NOT_PRESENT,
          PlayerPresence.INITIALIZING,
          PlayerPresence.RECONNECTING,
          PlayerPresence.BUFFERING,
          PlayerPresence.PRESENT,
        ].map((presence) => ({
          name: "https://exampleurl:2002",
          presence,
        })),
        {
          name: "https://exampleurl:2002",
          presence: PlayerPresence.ERROR,
          alerts,
        },
        {
          label: "INITIALIZING + alerts",
          name: "https://exampleurl:2002",
          presence: PlayerPresence.INITIALIZING,
          alerts,
        },
        {
          label: "INITIALIZING + no name",
          name: undefined,
          presence: PlayerPresence.INITIALIZING,
          alerts,
        },
      ];

      return (
        <>
          {playerStates.map((props) => (
            <MockMessagePipelineProvider
              key={props.presence}
              name={props.name}
              presence={props.presence}
              alerts={props.alerts}
            >
              <div style={{ padding: 8 }}>{props.label ?? props.presence}</div>
              <div>
                <Story />
              </div>
            </MockMessagePipelineProvider>
          ))}
        </>
      );
    },
    Grid,
  ],
  parameters: { colorScheme: "light" },
};

export const PlayerStatesChinese: Story = {
  ...PlayerStates,
  parameters: { colorScheme: "light", forceLanguage: "zh" },
};

export const PlayerStatesJapanese: Story = {
  ...PlayerStates,
  parameters: { colorScheme: "light", forceLanguage: "ja" },
};

const fileSources: MockMessagePipelineProps[] = [
  "mcap-local-file",
  "ros1-local-bagfile",
  "ros2-local-bagfile",
  "ulog-local-file",
  "remote-file",
].map((sourceId) => ({
  name: "longexampleurlwith_specialcharaters-and-portnumber.ext",
  urlState: { sourceId },
}));

const remoteSources: MockMessagePipelineProps[] = [
  "ros1-socket",
  "ros2-socket",
  "rosbridge-websocket",
  "foxglove-websocket",
  "velodyne-device",
  "some other source type",
].map((sourceId) => ({
  name: "https://longexampleurlwith_specialcharaters-and-portnumber:3030",
  urlState: { sourceId },
}));

export const DataSources: Story = {
  decorators: [
    (Story: StoryFn): React.JSX.Element => {
      const playerStates: (MockMessagePipelineProps & { label?: string })[] = [
        {
          name: "Adapted from nuScenes dataset. Copyright © 2020 nuScenes. https://www.nuscenes.org/terms-of-use",
          urlState: { sourceId: "sample-nuscenes" },
        },
        ...fileSources,
        ...remoteSources,
        {
          label: "with alerts",
          name: "https://longexampleurlwith_error-and-portnumber:3030",
          alerts,
        },
      ];

      return (
        <>
          {playerStates.map((props) => (
            <MockMessagePipelineProvider
              key={props.urlState?.sourceId}
              name={props.name}
              presence={PlayerPresence.PRESENT}
              urlState={props.urlState}
              alerts={props.alerts}
              seekPlayback={() => {}}
            >
              <div style={{ padding: 8 }}>{props.label ?? props.urlState?.sourceId}</div>
              <div>
                <Story />
              </div>
            </MockMessagePipelineProvider>
          ))}
        </>
      );
    },
    Grid,
  ],
  parameters: { colorScheme: "light" },
};

export const DataSourcesChinese: Story = {
  ...DataSources,
  parameters: { colorScheme: "light", forceLanguage: "zh" },
};
export const DataSourcesJapanese: Story = {
  ...DataSources,
  parameters: { colorScheme: "light", forceLanguage: "ja" },
};
