// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";
import { vec3 } from "gl-matrix";

import type { PointCloud } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import { QUAT_IDENTITY, rad2deg, VEC3_ZERO } from "./common";
import useDelayedFixture from "./useDelayedFixture";
import ThreeDeePanel from "../index";
import { TransformStamped } from "../ros";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeePanel,
  parameters: {
    colorScheme: "dark",
  },
};

export const Foxglove_PointCloud_RGBA_Settings: StoryObj = {
  render: () => <Foxglove_PointCloud includeSettings />,
  play: async () => {
    await userEvent.click(await screen.findByTestId("settings__nodeHeaderToggle__general"));
    await userEvent.click(
      await screen.findByTestId("settings__nodeHeaderToggle__topics-/pointcloud"),
    );
  },
};
export const Foxglove_PointCloud_RGBA_SettingsChinese: StoryObj = {
  ...Foxglove_PointCloud_RGBA_Settings,
  parameters: { forceLanguage: "zh" },
};
export const Foxglove_PointCloud_RGBA_SettingsJapanese: StoryObj = {
  ...Foxglove_PointCloud_RGBA_Settings,
  parameters: { forceLanguage: "ja" },
};

export const Foxglove_PointCloud_Gradient_Settings: StoryObj = {
  render: () => <Foxglove_PointCloud colorMode="gradient" includeSettings />,
  play: async () => {
    await userEvent.click(await screen.findByTestId("settings__nodeHeaderToggle__general"));
    await userEvent.click(
      await screen.findByTestId("settings__nodeHeaderToggle__topics-/pointcloud"),
    );
  },
};
export const Foxglove_PointCloud_Gradient_SettingsChinese: StoryObj = {
  ...Foxglove_PointCloud_Gradient_Settings,
  parameters: { forceLanguage: "zh" },
};
export const Foxglove_PointCloud_Gradient_SettingsJapanese: StoryObj = {
  ...Foxglove_PointCloud_Gradient_Settings,
  parameters: { forceLanguage: "ja" },
};

export const Foxglove_PointCloud_RGBA: StoryObj = {
  render: () => <Foxglove_PointCloud />,
};

export const Foxglove_PointCloud_RGBA_Square: StoryObj = {
  render: () => <Foxglove_PointCloud pointShape="square" />,
};

export const Foxglove_PointCloud_Gradient: StoryObj = {
  render: () => <Foxglove_PointCloud colorMode="gradient" />,
};

export const Foxglove_PointCloud_Gradient_Clamped: StoryObj = {
  render: () => <Foxglove_PointCloud colorMode="gradient" minValue={-2} maxValue={2} />,
};

export const Foxglove_PointCloud_Stixels: StoryObj = {
  render: () => <Foxglove_PointCloud colorMode="gradient" stixelsEnabled={true} />,
};

function Foxglove_PointCloud({
  pointShape = "circle",
  colorMode = "rgba-fields",
  minValue,
  maxValue,
  stixelsEnabled = false,
  debugPicking = false,
  includeSettings = false,
}: {
  pointShape?: "circle" | "square";
  colorMode?: "gradient" | "rgba-fields";
  minValue?: number;
  maxValue?: number;
  stixelsEnabled?: boolean;
  debugPicking?: boolean;
  includeSettings?: boolean;
}): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", schemaName: "foxglove.PointCloud" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const SCALE = 10 / 128;

  function f(x: number, y: number) {
    return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
  }

  function jet(x: number, a: number) {
    const i = Math.trunc(x * 255);
    const r = Math.max(0, Math.min(255, 4 * (i - 96), 255 - 4 * (i - 224)));
    const g = Math.max(0, Math.min(255, 4 * (i - 32), 255 - 4 * (i - 160)));
    const b = Math.max(0, Math.min(255, 4 * i + 127, 255 - 4 * (i - 96)));
    return { r, g, b, a };
  }

  const data = new Uint8Array(128 * 128 * 16);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let y = 0; y < 128; y += 3) {
    for (let x = 0; x < 128; x += 3) {
      const i = (y * 128 + x) * 16;
      view.setFloat32(i + 0, x * SCALE - 5, true);
      view.setFloat32(i + 4, y * SCALE - 5, true);
      view.setFloat32(i + 8, f(x, y) * 5, true);
      const { r, g, b, a } = jet(f(x, y) * 2, x / 128);
      view.setUint8(i + 12, r);
      view.setUint8(i + 13, g);
      view.setUint8(i + 14, b);
      view.setUint8(i + 15, (a * 255) | 0);
    }
  }

  const pointCloud: MessageEvent<PointCloud> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
      point_stride: 16,
      fields: [
        { name: "x", offset: 0, type: 7 },
        { name: "y", offset: 4, type: 7 },
        { name: "z", offset: 8, type: 7 },
        { name: "red", offset: 12, type: 1 },
        { name: "green", offset: 13, type: 1 },
        { name: "blue", offset: 14, type: 1 },
        { name: "alpha", offset: 15, type: 1 },
      ],
      data,
    },
    schemaName: "foxglove.PointCloud",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/pointcloud": [pointCloud],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture} includeSettings={includeSettings}>
      <ThreeDeePanel
        debugPicking={debugPicking}
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/pointcloud": {
              visible: true,
              pointSize: 10,
              pointShape,
              colorMode,
              colorField: "x",
              gradient: ["#17b3f6", "#09e609d5"],
              minValue,
              maxValue,
              stixelsEnabled,
            },
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: rad2deg(1.22),
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: rad2deg(-0.33),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}

function Foxglove_PointCloud_Intensity_Base({
  minValue,
  maxValue,
}: {
  minValue?: number;
  maxValue?: number;
}): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", schemaName: "foxglove.PointCloud" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const WIDTH = 128;
  const HW = 5;
  const SCALE = 10 / WIDTH;
  const SCALE_2 = 0.5 * SCALE;
  const STEP = 13;
  const METABALLS: [number, number, number, number][] = [
    [0, 0, 2, 1.5],
    [2.2, 2, 3, 0.75],
    [2.1, -0.1, 4, 0.5],
    [-1.2, -1, 1, 0.5],
  ];

  const tempVec: vec3 = [0, 0, 0];
  function inside(p: vec3): number {
    let sum = 0;
    for (const metaball of METABALLS) {
      tempVec[0] = metaball[0];
      tempVec[1] = metaball[1];
      tempVec[2] = metaball[2];
      const r = metaball[3];
      const d2 = Math.max(Number.EPSILON, vec3.squaredDistance(p, tempVec) - r * r);
      sum += Math.pow(1 / d2, 2);
    }
    return sum >= 1 ? 1 : 0;
  }

  function countInside(xi: number, yi: number, zi: number): number {
    const p0: vec3 = [xi * SCALE - HW - SCALE_2, yi * SCALE - HW - SCALE_2, zi * SCALE - SCALE_2];
    const p1: vec3 = [xi * SCALE - HW + SCALE_2, yi * SCALE - HW - SCALE_2, zi * SCALE - SCALE_2];
    const p2: vec3 = [xi * SCALE - HW - SCALE_2, yi * SCALE - HW + SCALE_2, zi * SCALE - SCALE_2];
    const p3: vec3 = [xi * SCALE - HW + SCALE_2, yi * SCALE - HW + SCALE_2, zi * SCALE - SCALE_2];
    const p4: vec3 = [xi * SCALE - HW - SCALE_2, yi * SCALE - HW - SCALE_2, zi * SCALE + SCALE_2];
    const p5: vec3 = [xi * SCALE - HW + SCALE_2, yi * SCALE - HW - SCALE_2, zi * SCALE + SCALE_2];
    const p6: vec3 = [xi * SCALE - HW - SCALE_2, yi * SCALE - HW + SCALE_2, zi * SCALE + SCALE_2];
    const p7: vec3 = [xi * SCALE - HW + SCALE_2, yi * SCALE - HW + SCALE_2, zi * SCALE + SCALE_2];

    return (
      inside(p0) +
      inside(p1) +
      inside(p2) +
      inside(p3) +
      inside(p4) +
      inside(p5) +
      inside(p6) +
      inside(p7)
    );
  }

  const data = new Uint8Array(WIDTH * WIDTH * WIDTH * STEP);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let zi = 0; zi < WIDTH; zi++) {
    for (let yi = 0; yi < WIDTH; yi++) {
      for (let xi = 0; xi < WIDTH; xi++) {
        const i = (zi * WIDTH + yi) * WIDTH * STEP + xi * STEP;
        const count = countInside(xi, yi, zi);
        if (count !== 0 && count !== 8) {
          view.setFloat32(i + 0, xi * SCALE - HW, true);
          view.setFloat32(i + 4, yi * SCALE - HW, true);
          view.setFloat32(i + 8, zi * SCALE, true);
          const position = xi * 0.5 + yi * 0.5 + zi * 0.5;
          const surface = ((count / 7) * 255) / 2 + (xi / 2 + yi / 2 + zi / 2);
          view.setUint8(i + 12, Math.trunc(position * 0.8 + surface * 0.2));
        } else {
          view.setFloat32(i + 0, Number.NaN, true);
          view.setFloat32(i + 4, Number.NaN, true);
          view.setFloat32(i + 8, Number.NaN, true);
          view.setUint8(i + 12, 255);
        }
      }
    }
  }

  const pointCloud: MessageEvent<PointCloud> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      point_stride: 13,
      pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
      fields: [
        { name: "x", offset: 0, type: 7 },
        { name: "y", offset: 4, type: 7 },
        { name: "z", offset: 8, type: 7 },
        { name: "intensity", offset: 12, type: 1 },
      ],
      data,
    },
    schemaName: "foxglove.PointCloud",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/pointcloud": [pointCloud],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeePanel
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/pointcloud": {
              visible: true,
              pointSize: 5,
              minValue,
              maxValue,
            },
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: rad2deg(1.22),
            targetOffset: [0.25, -0.5, 3],
            thetaOffset: rad2deg(-0.33),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}

export const Foxglove_PointCloud_Intensity: StoryObj = {
  render: () => Foxglove_PointCloud_Intensity_Base({}),
};

export const Foxglove_PointCloud_Intensity_Clamped: StoryObj = {
  render: () =>
    Foxglove_PointCloud_Intensity_Base({
      minValue: 80,
      maxValue: 130,
    }),
};

export const Foxglove_PointCloud_TwoDimensions: StoryObj = {
  render: function Story() {
    const topics: Topic[] = [{ name: "/pointcloud", schemaName: "foxglove.PointCloud" }];

    const SCALE = 10 / 128;

    function f(x: number, y: number) {
      return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
    }

    const data = new Uint8Array(128 * 128 * 12);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 12;
        view.setFloat32(i + 0, x * SCALE - 5, true);
        view.setFloat32(i + 4, y * SCALE - 5, true);
        view.setFloat32(i + 8, f(x, y) * 5, true);
      }
    }

    const pointCloud: MessageEvent<PointCloud> = {
      topic: "/pointcloud",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        timestamp: { sec: 0, nsec: 0 },
        frame_id: "sensor",
        point_stride: 12,
        pose: { position: VEC3_ZERO, orientation: { x: 0.707, y: 0, z: 0, w: 0.707 } },
        fields: [
          { name: "x", offset: 0, type: 7 },
          { name: "y", offset: 4, type: 7 },
        ],
        data,
      },
      schemaName: "foxglove.PointCloud",
      sizeInBytes: 0,
    };

    const fixture = useDelayedFixture({
      topics,
      frame: {
        "/pointcloud": [pointCloud],
      },
      capabilities: [],
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
      },
    });

    return (
      <PanelSetup fixture={fixture}>
        <ThreeDeePanel
          overrideConfig={{
            followTf: "sensor",
            layers: {
              grid: { layerId: "foxglove.Grid" },
            },
            cameraState: {
              distance: 13.5,
              perspective: true,
              phi: rad2deg(1.22),
              targetOffset: [0.25, -0.5, 0],
              thetaOffset: rad2deg(-0.33),
              fovy: rad2deg(0.75),
              near: 0.01,
              far: 5000,
              target: [0, 0, 0],
              targetOrientation: [0, 0, 0, 1],
            },
            topics: {
              "/pointcloud": { visible: true },
            },
          }}
        />
      </PanelSetup>
    );
  },
};

function HistoryPickingStory(): JSX.Element {
  const topics: Topic[] = [{ name: "/pointcloud", schemaName: "foxglove.PointCloud" }];
  const point_stride = 12;
  function makePointCloudData(t: number) {
    const numPoints = 10;
    const data = new Uint8Array(numPoints * point_stride);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;
    for (let i = 0; i < numPoints; i++) {
      view.setFloat32(offset + 0, i * 0.1 + t * 0.5, true);
      view.setFloat32(offset + 4, 0.2 * Math.sin((2 * Math.PI * i) / numPoints) + t, true);
      view.setFloat32(offset + 8, 0, true);
      offset += point_stride;
    }
    return data;
  }

  const cloud1: MessageEvent<PointCloud> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 10, nsec: 0 },
      frame_id: "sensor",
      pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
      point_stride,
      fields: [
        { name: "x", offset: 0, type: 7 },
        { name: "y", offset: 4, type: 7 },
        { name: "z", offset: 8, type: 7 },
      ],
      data: makePointCloudData(1),
    },
    schemaName: "foxglove.PointCloud",
    sizeInBytes: 0,
  };

  const cloud2: MessageEvent<PointCloud> = {
    ...cloud1,
    receiveTime: { sec: 20, nsec: 0 },
    message: {
      ...cloud1.message,
      timestamp: { sec: 20, nsec: 0 },
      data: makePointCloudData(2),
    },
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/pointcloud": [cloud1, cloud2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 21, nsec: 0 },
    },
  });

  return (
    <div style={{ width: 600, height: 400, flexShrink: 0 }}>
      <PanelSetup fixture={fixture}>
        <ThreeDeePanel
          debugPicking
          overrideConfig={{
            followTf: "sensor",
            topics: {
              "/pointcloud": {
                visible: true,
                pointSize: 20,
                pointShape: "circle",
                colorMode: "gradient",
                colorField: "x",
                gradient: ["#17b3f6", "#09e609d5"],
                decayTime: 20,
              },
            },
            cameraState: {
              distance: 4,
              perspective: false,
              targetOffset: [2, 1, 0],
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

/** Click background to render overall hitmap */
export const Foxglove_PointCloud_HistoryPicking: StoryObj = {
  render: HistoryPickingStory,
  async play() {
    await userEvent.click(await screen.findByTestId("ExpandingToolbar-Inspect objects"));
    await userEvent.pointer({
      target: document.querySelector("canvas")!,
      keys: "[MouseLeft]",
      coords: { clientX: 0, clientY: 0 },
    });
  },
};

/** Click first cloud */
export const Foxglove_PointCloud_HistoryPickingInstances1: StoryObj = {
  render: HistoryPickingStory,
  async play() {
    await userEvent.click(await screen.findByTestId("ExpandingToolbar-Inspect objects"));
    await userEvent.pointer({
      target: document.querySelector("canvas")!,
      keys: "[MouseLeft]",
      coords: { clientX: 173, clientY: 206 },
    });
  },
};

/** Click second cloud */
export const Foxglove_PointCloud_HistoryPickingInstances2: StoryObj = {
  render: HistoryPickingStory,
  async play() {
    await userEvent.click(await screen.findByTestId("ExpandingToolbar-Inspect objects"));
    await userEvent.pointer({
      target: document.querySelector("canvas")!,
      keys: "[MouseLeft]",
      coords: { clientX: 255, clientY: 123 },
    });
  },
};

export const Foxglove_PointCloud_Distance: StoryObj = {
  render: () => <Foxglove_PointCloud_Distance_Base />,
};

function Foxglove_PointCloud_Distance_Base(): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", schemaName: "foxglove.PointCloud" },
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const WIDTH = 100;
  const SCALE = 10 / WIDTH;
  const STEP = 12;
  const HEIGHT = 0;

  const HORIZONTAL_OFFSET = (WIDTH * SCALE) / 2;

  const data = new Uint8Array(WIDTH * WIDTH * STEP);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let xi = 0; xi < WIDTH; xi++) {
    for (let yi = 0; yi < WIDTH; yi++) {
      const i = (xi * WIDTH + yi) * STEP;
      view.setFloat32(i + 0, xi * SCALE - HORIZONTAL_OFFSET, true);
      view.setFloat32(i + 4, yi * SCALE - HORIZONTAL_OFFSET, true);
      view.setFloat32(i + 8, HEIGHT, true);
    }
  }

  const pointCloud: MessageEvent<PointCloud> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "base_link",
      point_stride: 12,
      pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
      fields: [
        { name: "x", offset: 0, type: 7 },
        { name: "y", offset: 4, type: 7 },
        { name: "z", offset: 8, type: 7 },
      ],
      data,
    },
    schemaName: "foxglove.PointCloud",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/pointcloud": [pointCloud],
      "/tf": [tf1],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeePanel
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/pointcloud": {
              visible: true,
              pointSize: 5,
              colorMode: "colormap",
              colorField: "_auto_distance",
            },
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 20,
            perspective: true,
            phi: 60,
            targetOffset: [0, 0, 0],
            thetaOffset: 30,
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}
