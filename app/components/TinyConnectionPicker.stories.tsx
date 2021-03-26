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

import { storiesOf } from "@storybook/react";

import MockMessagePipelineProvider from "@foxglove-studio/app/components/MessagePipeline/MockMessagePipelineProvider";
import TinyConnectionPicker from "@foxglove-studio/app/components/TinyConnectionPicker";
import PlayerSelectionContext, {
  PlayerSelection,
  PlayerSourceDefinition,
} from "@foxglove-studio/app/context/PlayerSelectionContext";

storiesOf("<TinyConnectionPicker>", module).add("default", () => {
  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "Bag File",
      type: "file",
    },
    {
      name: "ROS",
      type: "ros1-core",
    },
    {
      name: "Websocket",
      type: "ws",
    },
    {
      name: "HTTP",
      type: "http",
    },
  ];

  const value: PlayerSelection = {
    selectSource: () => {},
    setPlayerFromDemoBag: async () => {},
    availableSources: playerSources,
  };

  return (
    <PlayerSelectionContext.Provider value={value}>
      <MockMessagePipelineProvider>
        <div style={{ padding: 8, textAlign: "right", width: "100%" }}>
          <TinyConnectionPicker defaultIsOpen />
        </div>
      </MockMessagePipelineProvider>
    </PlayerSelectionContext.Provider>
  );
});
