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

import { storiesOf } from "@storybook/react";

import { PlayerStateActiveData } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import { UnconnectedPlaybackPerformance, UnconnectedPlaybackPerformanceProps } from ".";

const defaultActiveData: PlayerStateActiveData = {
  messages: [],
  startTime: { sec: 0, nsec: 0 },
  currentTime: { sec: 10, nsec: 0 },
  endTime: { sec: 20, nsec: 0 },
  isPlaying: true,
  speed: 5.0,
  messageOrder: "receiveTime",
  lastSeekTime: 0,
  topics: [],
  datatypes: new Map(),
  parsedMessageDefinitionsByTopic: {},
  totalBytesReceived: 0,
};

function Example({ states }: { states: UnconnectedPlaybackPerformanceProps[] }) {
  const [state, setState] = React.useState(states);
  React.useEffect(() => {
    if (state.length > 1) {
      setState(state.slice(1));
    }
  }, [state]);
  return <UnconnectedPlaybackPerformance {...state[0]!} />;
}

storiesOf("panels/PlaybackPerformance", module).add("simple example", () => {
  const states = [
    {
      timestamp: 1000,
      activeData: defaultActiveData,
    },
    {
      timestamp: 1500,
      activeData: {
        ...defaultActiveData,
        totalBytesReceived: 1e6,
        currentTime: { sec: 11, nsec: 0 },
      },
    },
  ];
  return (
    <PanelSetup>
      <Example states={states} />
    </PanelSetup>
  );
});
