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

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import TinyConnectionPicker from "@foxglove/studio-base/components/TinyConnectionPicker";
import PlayerSelectionContext, {
  PlayerSelection,
  PlayerSourceDefinition,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

export default {
  title: "components/TinyConnectionPicker",
  component: TinyConnectionPicker,
};

export function Default(): React.ReactElement {
  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "ROS 1",
      type: "ros1-socket",
    },
    {
      name: "Rosbridge (WebSocket)",
      type: "ros-ws",
    },
    {
      name: "ROS 1 Bag File (local)",
      type: "ros1-local-bagfile",
    },
    {
      name: "ROS 1 Bag File (HTTP)",
      type: "ros1-remote-bagfile",
    },
    {
      name: "ROS 2 Bag Folder (local)",
      type: "ros2-folder",
    },
    {
      name: "Velodyne LIDAR",
      type: "velodyne-device",
    },
  ];

  const value: PlayerSelection = {
    selectSource: () => {},
    availableSources: playerSources,
  };

  return (
    <PlayerSelectionContext.Provider value={value}>
      <MockMessagePipelineProvider>
        <div style={{ padding: 8, width: "100%", height: 400 }}>
          <TinyConnectionPicker defaultIsOpen />
        </div>
      </MockMessagePipelineProvider>
    </PlayerSelectionContext.Provider>
  );
}
