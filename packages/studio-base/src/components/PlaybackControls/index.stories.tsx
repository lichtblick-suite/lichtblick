// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { action } from "@storybook/addon-actions";
import { Story } from "@storybook/react";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import AppConfigurationContext, {
  AppConfiguration,
} from "@foxglove/studio-base/context/AppConfigurationContext";
import {
  PlayerCapabilities,
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
} from "@foxglove/studio-base/players/types";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";

import PlaybackControls from "./index";

const START_TIME = 1531761690;

function getPlayerState(): PlayerState {
  const player: PlayerState = {
    presence: PlayerPresence.PRESENT,
    progress: {},
    capabilities: [PlayerCapabilities.setSpeed, PlayerCapabilities.playbackControl],
    playerId: "1",
    activeData: {
      messages: [],
      messageOrder: "receiveTime",
      startTime: { sec: START_TIME, nsec: 331 },
      endTime: { sec: START_TIME + 20, nsec: 331 },
      currentTime: { sec: START_TIME + 5, nsec: 331 },
      isPlaying: true,
      speed: 0.2,
      lastSeekTime: 0,
      topics: [{ name: "/empty_topic", datatype: "VoidType" }],
      datatypes: new Map(Object.entries({ VoidType: { definitions: [] } })),
      parsedMessageDefinitionsByTopic: {},
      totalBytesReceived: 1234,
    },
  };
  return player;
}

const mockAppConfiguration: AppConfiguration = {
  get: () => undefined,
  set: async () => {},
  addChangeListener: () => {},
  removeChangeListener: () => {},
};

function Wrapper({
  isPlaying = false,
  activeData,
  children,
  progress,
}: {
  isPlaying?: boolean;
  activeData?: PlayerStateActiveData;
  children: React.ReactNode;
  progress?: PlayerState["progress"];
}) {
  return (
    <AppConfigurationContext.Provider value={mockAppConfiguration}>
      <MockCurrentLayoutProvider>
        <MockMessagePipelineProvider
          isPlaying={isPlaying}
          capabilities={["setSpeed", "playbackControl"]}
          activeData={activeData}
          pausePlayback={action("pause")}
          seekPlayback={action("seek")}
          startPlayback={action("play")}
          progress={progress}
        >
          <div style={{ padding: 20, margin: 20 }}>{children}</div>
        </MockMessagePipelineProvider>
      </MockCurrentLayoutProvider>
    </AppConfigurationContext.Provider>
  );
}

export default {
  title: "components/PlaybackControls",
};

export const Playing: Story = () => {
  return (
    <Wrapper isPlaying>
      <PlaybackControls />
    </Wrapper>
  );
};
Playing.parameters = { colorScheme: "both-column" };

export const Paused: Story = () => {
  return (
    <Wrapper>
      <PlaybackControls />
    </Wrapper>
  );
};
Paused.parameters = { colorScheme: "both-column" };

export const DownloadProgressByRanges: Story = () => {
  const player = getPlayerState();
  player.progress = {
    ...player.progress,
    fullyLoadedFractionRanges: [
      { start: 0.23, end: 0.6 },
      { start: 0.7, end: 1 },
    ],
  };
  return (
    <Wrapper progress={player.progress}>
      <PlaybackControls />
    </Wrapper>
  );
};
DownloadProgressByRanges.parameters = { colorScheme: "both-column" };
