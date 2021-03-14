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
import { storiesOf } from "@storybook/react";
import { createMemoryHistory } from "history";
import TestUtils from "react-dom/test-utils";

import { UnconnectedPlaybackControls } from ".";
import styles from "./index.module.scss";
import { setPlaybackConfig } from "@foxglove-studio/app/actions/panels";
import { MockMessagePipelineProvider } from "@foxglove-studio/app/components/MessagePipeline";
import {
  PlayerCapabilities,
  PlayerState,
  PlayerStateActiveData,
} from "@foxglove-studio/app/players/types";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";

const START_TIME = 1531761690;

function getPlayerState(): PlayerState {
  const player: PlayerState = {
    isPresent: true,
    showSpinner: false,
    showInitializing: false,
    progress: {},
    capabilities: [PlayerCapabilities.setSpeed],
    playerId: "1",
    activeData: {
      messages: [],
      bobjects: [],
      messageOrder: "receiveTime",
      startTime: { sec: START_TIME, nsec: 331 },
      endTime: { sec: START_TIME + 20, nsec: 331 },
      currentTime: { sec: START_TIME + 5, nsec: 331 },
      isPlaying: true,
      speed: 0.2,
      lastSeekTime: 0,
      topics: [{ name: "/empty_topic", datatype: "VoidType" }],
      datatypes: { VoidType: { fields: [] } },
      parsedMessageDefinitionsByTopic: {},
      playerWarnings: {},
      totalBytesReceived: 1234,
    },
  };
  return player;
}

function Wrapper({
  activeData,
  children,
  store,
}: {
  activeData?: PlayerStateActiveData;
  children: React.ReactNode;
  store?: any;
}) {
  return (
    <MockMessagePipelineProvider capabilities={["setSpeed"]} store={store} activeData={activeData}>
      <div style={{ padding: 20, margin: 100 }}>{children}</div>
    </MockMessagePipelineProvider>
  );
}

storiesOf("<PlaybackControls>", module)
  .add("playing", () => {
    const pause = action("pause");
    const play = action("play");
    const seek = action("seek");
    const player = getPlayerState();
    return (
      <Wrapper>
        <UnconnectedPlaybackControls player={player} pause={pause} play={play} seek={seek} />
      </Wrapper>
    );
  })
  .add("paused", () => {
    const pause = action("pause");
    const play = action("play");
    const seek = action("seek");
    const player = getPlayerState();

    // satisify flow
    if (player.activeData) {
      player.activeData.isPlaying = false;
      player.activeData.startTime.sec += 1;
      player.activeData.endTime.sec += 1;
    }
    return (
      <Wrapper>
        <UnconnectedPlaybackControls player={player} pause={pause} play={play} seek={seek} />
      </Wrapper>
    );
  })
  .add("tooltip", () => {
    const pause = action("pause");
    const play = action("play");
    const seek = action("seek");
    const player = getPlayerState();

    if (player.activeData) {
      player.activeData.isPlaying = false;
      player.activeData.startTime.sec += 1;
      player.activeData.endTime.sec += 1;
    }

    React.useEffect(() => {
      const [element] = document.getElementsByClassName(styles.sliderContainer);
      if (element) {
        TestUtils.Simulate.mouseMove(element, { clientX: 450 });
      }
    });
    return (
      <Wrapper>
        <UnconnectedPlaybackControls player={player} pause={pause} play={play} seek={seek} />
      </Wrapper>
    );
  })
  .add("download progress by ranges", () => {
    const player = getPlayerState();
    const pause = action("pause");
    const play = action("play");
    const seek = action("seek");
    player.progress = {
      ...player.progress,
      fullyLoadedFractionRanges: [
        { start: 0.23, end: 0.6 },
        { start: 0.7, end: 1 },
      ],
    };
    return (
      <Wrapper>
        <UnconnectedPlaybackControls player={player} pause={pause} play={play} seek={seek} />
      </Wrapper>
    );
  })
  .add("missing headers", () => {
    const store = configureStore(createRootReducer(createMemoryHistory()));
    store.dispatch(setPlaybackConfig({ messageOrder: "headerStamp" }));
    const defaultPlayerState = getPlayerState();
    const player = {
      ...defaultPlayerState,
      activeData: {
        ...defaultPlayerState.activeData,
        messageOrder: "headerStamp",
        playerWarnings: {
          topicsWithoutHeaderStamps: ["/empty_topic"],
        },
      },
    };
    const pause = action("pause");
    const play = action("play");
    const seek = action("seek");
    return (
      <Wrapper activeData={player.activeData as any} store={store}>
        <UnconnectedPlaybackControls player={player as any} pause={pause} play={play} seek={seek} />
      </Wrapper>
    );
  })
  .add("missing headers modal", () => {
    const store = configureStore(createRootReducer(createMemoryHistory()));
    store.dispatch(setPlaybackConfig({ messageOrder: "headerStamp" }));
    const defaultPlayerState = getPlayerState();
    const player = {
      ...defaultPlayerState,
      activeData: {
        ...defaultPlayerState.activeData,
        messageOrder: "headerStamp",
        playerWarnings: {
          topicsWithoutHeaderStamps: ["/empty_topic"],
        },
      },
    };
    const pause = action("pause");
    const play = action("play");
    const seek = action("seek");

    function click() {
      const element = document.querySelector("[data-test='missing-headers-icon']");
      if (element) {
        TestUtils.Simulate.click(element);
      }
    }

    // wrap the component so we can get a ref to it and force a mouse over and out event
    function ControlsWithModal() {
      React.useEffect(() => click());
      return (
        <UnconnectedPlaybackControls player={player as any} pause={pause} play={play} seek={seek} />
      );
    }

    return (
      <Wrapper activeData={player.activeData as any} store={store}>
        <ControlsWithModal />
      </Wrapper>
    );
  });
