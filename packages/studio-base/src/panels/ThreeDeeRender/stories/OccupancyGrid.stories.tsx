// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { screen, userEvent, waitFor } from "@storybook/testing-library";

import { MessageEvent } from "@foxglove/studio";
import { LayerSettingsOccupancyGrid } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/OccupancyGrids";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";
import ThreeDeePanel from "../index";
import { OccupancyGrid, TransformStamped } from "../ros";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeePanel,
  parameters: { colorScheme: "light" },
};

function makeGridData({ width, height }: { width: number; height: number }) {
  const grid = new Int8Array(width * height);
  const view = new DataView(grid.buffer, grid.byteOffset, grid.byteLength);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      view.setInt8(i * width + j, (j - 128) % 256);
    }
  }
  return grid;
}

function BaseStory({ includeSettings = false }: { includeSettings?: boolean }): JSX.Element {
  const topics: Topic[] = [
    { name: "/grid", schemaName: "nav_msgs/OccupancyGrid" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    schemaName: "geometry_msgs/TransformStamped",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    schemaName: "geometry_msgs/TransformStamped",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };

  const costmap: MessageEvent<OccupancyGrid> = {
    topic: "/costmap",
    schemaName: "nav_msgs/OccupancyGrid",
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      info: {
        map_load_time: { sec: 0, nsec: 0 },
        resolution: 0.02,
        width: 256,
        height: 256,
        origin: { position: { x: -5.5, y: -2.5, z: 0 }, orientation: QUAT_IDENTITY },
      },
      data: makeGridData({ width: 256, height: 256 }),
    },
    sizeInBytes: 0,
  };

  topics.push({ name: "/costmap", schemaName: "nav_msgs/OccupancyGrid" });

  const custom: MessageEvent<OccupancyGrid> = {
    topic: "/custom",
    schemaName: "nav_msgs/OccupancyGrid",
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      info: {
        map_load_time: { sec: 0, nsec: 0 },
        resolution: 0.02,
        width: 256,
        height: 256,
        origin: { position: { x: 0.5, y: -2.5, z: 0 }, orientation: QUAT_IDENTITY },
      },
      data: makeGridData({ width: 256, height: 256 }),
    },
    sizeInBytes: 0,
  };

  topics.push({ name: "/custom", schemaName: "nav_msgs/OccupancyGrid" });
  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/costmap": [costmap],
      "/custom": [custom],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <div style={{ width: 1000, height: 800 }}>
      <PanelSetup fixture={fixture} includeSettings={includeSettings}>
        <ThreeDeePanel
          overrideConfig={{
            followTf: "base_link",
            topics: {
              "/costmap": {
                visible: true,
                colorMode: "costmap",
              } as LayerSettingsOccupancyGrid,
              "/custom": {
                visible: true,
              } as LayerSettingsOccupancyGrid,
            },
            layers: {
              grid: { layerId: "foxglove.Grid" },
            },
            cameraState: {
              distance: 13.5,
              perspective: true,
              phi: 0.1,
              targetOffset: [0.25, -0.5, 0],
              thetaOffset: 0,
              fovy: rad2deg(0.75),
              near: 0.01,
              far: 5000,
              target: [0, 0, 0],
              targetOrientation: [0, 0, 0, 1],
            },
          }}
        />
      </PanelSetup>
    </div>
  );
}

export const Occupancy_Grid_Costmap: StoryObj = {
  render: () => {
    return <BaseStory />;
  },
};

export const Occupancy_Grid_Costmap_With_Pick_Settings: StoryObj = {
  render: function Story() {
    return <BaseStory includeSettings />;
  },

  play: async () => {
    const { click, hover, pointer } = userEvent.setup();
    await hover(await screen.findByTestId(/panel-mouseenter-container/));
    await click(screen.getByRole("button", { name: /inspect objects/i }));
    const canvas = document.querySelector("canvas")!;

    // only worked after two clicks, but I'm not sure why
    await waitFor(
      async () => {
        await pointer({
          target: canvas,
          keys: "[MouseLeft]",
          coords: { clientX: 800, clientY: 400 },
        });
        await screen.findByRole("button", { name: /show settings/i });
      },
      { timeout: 1000 },
    );

    await userEvent.click(await screen.findByRole("button", { name: /show settings/i }));
  },
};

export const OccupancyGridCostmapWithSettingsChinese: StoryObj = {
  ...Occupancy_Grid_Costmap_With_Pick_Settings,
  parameters: { forceLanguage: "zh" },
};
export const OccupancyGridCostmapWithSettingsJapanese: StoryObj = {
  ...Occupancy_Grid_Costmap_With_Pick_Settings,
  parameters: { forceLanguage: "ja" },
};
