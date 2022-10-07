// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { vec3 } from "gl-matrix";

import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { PointCloud2, TransformStamped } from "../ros";
import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

function rgba(r: number, g: number, b: number, a: number) {
  return (
    (Math.trunc(r * 255) << 24) |
    (Math.trunc(g * 255) << 16) |
    (Math.trunc(b * 255) << 8) |
    Math.trunc(a * 255)
  );
}

export const SensorMsgs_PointCloud2_RGBA = (): JSX.Element => (
  <SensorMsgs_PointCloud2 rgbaFieldName="rgba" />
);
SensorMsgs_PointCloud2_RGBA.parameters = { colorScheme: "dark" };

export const SensorMsgs_PointCloud2_RGB = (): JSX.Element => (
  <SensorMsgs_PointCloud2 rgbaFieldName="rgb" />
);
SensorMsgs_PointCloud2_RGB.parameters = { colorScheme: "dark" };

function SensorMsgs_PointCloud2({ rgbaFieldName }: { rgbaFieldName: string }): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", schemaName: "sensor_msgs/PointCloud2" },
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

  function jet(x: number, a: number): number {
    const i = Math.trunc(x * 255);
    const r = Math.max(0, Math.min(255, 4 * (i - 96), 255 - 4 * (i - 224)));
    const g = Math.max(0, Math.min(255, 4 * (i - 32), 255 - 4 * (i - 160)));
    const b = Math.max(0, Math.min(255, 4 * i + 127, 255 - 4 * (i - 96)));
    return rgba(r / 255, g / 255, b / 255, a);
  }

  const data = new Uint8Array(128 * 128 * 16);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let y = 0; y < 128; y += 3) {
    for (let x = 0; x < 128; x += 3) {
      const i = (y * 128 + x) * 16;
      view.setFloat32(i + 0, x * SCALE - 5, true);
      view.setFloat32(i + 4, y * SCALE - 5, true);
      view.setFloat32(i + 8, f(x, y) * 5, true);
      view.setUint32(i + 12, jet(f(x, y) * 2, x / 128), true);
    }
  }

  const pointCloud: MessageEvent<PointCloud2> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      height: 1,
      width: 128 * 128,
      fields: [
        { name: "x", offset: 0, datatype: 7, count: 1 },
        { name: "y", offset: 4, datatype: 7, count: 1 },
        { name: "z", offset: 8, datatype: 7, count: 1 },
        { name: rgbaFieldName, offset: 12, datatype: 6, count: 1 },
      ],
      is_bigendian: false,
      point_step: 16,
      row_step: 128 * 128 * 16,
      data,
      is_dense: true,
    },
    schemaName: "sensor_msgs/PointCloud2",
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
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/pointcloud": {
              visible: true,
              pointSize: 10,
              colorMode: rgbaFieldName,
              colorField: rgbaFieldName,
              rgbByteOrder: "rgba",
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

SensorMsgs_PointCloud2_Intensity.parameters = { colorScheme: "dark" };
export function SensorMsgs_PointCloud2_Intensity(): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", schemaName: "sensor_msgs/PointCloud2" },
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

  const pointCloud: MessageEvent<PointCloud2> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      height: 1,
      width: WIDTH * WIDTH * WIDTH,
      fields: [
        { name: "x", offset: 0, datatype: 7, count: 1 },
        { name: "y", offset: 4, datatype: 7, count: 1 },
        { name: "z", offset: 8, datatype: 7, count: 1 },
        { name: "intensity", offset: 12, datatype: 2, count: 1 },
      ],
      is_bigendian: false,
      point_step: 13,
      row_step: WIDTH * WIDTH * WIDTH * STEP,
      data,
      is_dense: false,
    },
    schemaName: "sensor_msgs/PointCloud2",
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
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/pointcloud": {
              visible: true,
              pointSize: 5,
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

// Render a flat plane if we only have two dimensions
SensorMsgs_PointCloud2_TwoDimensions.parameters = { colorScheme: "dark" };
export function SensorMsgs_PointCloud2_TwoDimensions(): JSX.Element {
  const topics: Topic[] = [{ name: "/pointcloud", schemaName: "sensor_msgs/PointCloud2" }];

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

  const pointCloud: MessageEvent<PointCloud2> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "sensor" },
      height: 1,
      width: 128 * 128,
      fields: [
        { name: "x", offset: 0, datatype: 7, count: 1 },
        { name: "y", offset: 4, datatype: 7, count: 1 },
      ],
      is_bigendian: false,
      point_step: 12,
      row_step: 128 * 128 * 12,
      data,
      is_dense: true,
    },
    schemaName: "sensor_msgs/PointCloud2",
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
      <ThreeDeeRender
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
}
