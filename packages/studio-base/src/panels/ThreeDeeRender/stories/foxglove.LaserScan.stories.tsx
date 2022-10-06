// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { fromSec } from "@foxglove/rostime";
import { FrameTransform, LaserScan, PointCloud } from "@foxglove/schemas";
import { MessageEvent, Topic } from "@foxglove/studio";
import { xyzrpyToPose } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

import ThreeDeeRender from "../index";
import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender/foxglove.LaserScan",
  component: ThreeDeeRender,
  parameters: { colorScheme: "dark" },
};

function Foxglove_LaserScan({
  time = 0,
  rangeMin = 0,
  rangeMax = 6,
  settings,
}: {
  time?: number;
  rangeMin?: number;
  rangeMax?: number;
  settings: Record<string, unknown>;
}): JSX.Element {
  const topics: Topic[] = [
    { name: "/scan", datatype: "foxglove.LaserScan" },
    { name: "/tf", datatype: "foxglove.FrameTransform" },
  ];
  const tf1: MessageEvent<FrameTransform> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: "map",
      child_frame_id: "base_link",
      translation: { x: 1e7, y: 0, z: 0 },
      rotation: QUAT_IDENTITY,
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<FrameTransform> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: "base_link",
      child_frame_id: "sensor",
      translation: { x: 0, y: 0, z: 1 },
      rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };
  const tf3: MessageEvent<FrameTransform> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 10, nsec: 0 },
      parent_frame_id: "base_link",
      child_frame_id: "sensor",
      translation: { x: 0, y: 5, z: 1 },
      rotation: QUAT_IDENTITY,
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };

  const count = 100;

  const ranges = new Float32Array(count);
  const intensities = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / (count + 1);
    ranges[i] = 1 + 3 * t;
    if (ranges[i]! < rangeMin || ranges[i]! > rangeMax) {
      ranges[i] = NaN;
    }
    intensities[i] = Math.cos(2 * Math.PI * 4 * t);
  }

  const laserScan: MessageEvent<LaserScan> = {
    topic: "/scan",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      pose: xyzrpyToPose([-2, 0, 0], [0, 0, 90]),
      start_angle: 0,
      end_angle: 2 * Math.PI,
      ranges: ranges as unknown as number[],
      intensities: intensities as unknown as number[],
    },
    schemaName: "foxglove.LaserScan",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/scan": [laserScan],
      "/tf": [tf1, tf2, tf3],
    },
    capabilities: [],
    activeData: {
      currentTime: fromSec(time),
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          scene: { enableStats: false },
          topics: {
            "/scan": {
              visible: true,
              pointSize: 10,
              colorMode: "colormap",
              colorMap: "turbo",
              colorField: "intensity",
              ...settings,
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

export const Square = Object.assign(Foxglove_LaserScan.bind({}), {
  args: {
    settings: {
      pointShape: "square",
    },
  },
});

export const Size20 = Object.assign(Foxglove_LaserScan.bind({}), {
  args: {
    settings: {
      pointSize: 20,
    },
  },
});

export const FlatColor = Object.assign(Foxglove_LaserScan.bind({}), {
  args: {
    settings: {
      colorMode: "flat",
      flatColor: "#ff00ff",
    },
  },
});

export const CustomGradient = Object.assign(Foxglove_LaserScan.bind({}), {
  args: {
    settings: {
      colorMode: "gradient",
      gradient: ["#00ffff", "#0000ff"],
    },
  },
});

export const RangeLimits = Object.assign(Foxglove_LaserScan.bind({}), {
  args: {
    rangeMin: 2,
    rangeMax: 3,
  },
});

export const Time0 = Object.assign(Foxglove_LaserScan.bind({}), {
  args: {
    time: 0,
  },
});

export const Time5 = Object.assign(Foxglove_LaserScan.bind({}), {
  args: {
    time: 5,
  },
});

export const Time10 = Object.assign(Foxglove_LaserScan.bind({}), {
  args: {
    time: 10,
  },
});

export function ComparisonWithPointCloudColors(): JSX.Element {
  const topics: Topic[] = [
    { name: "/scan", datatype: "foxglove.LaserScan" },
    { name: "/cloud", datatype: "foxglove.PointCloud" },
    { name: "/tf", datatype: "foxglove.FrameTransform" },
  ];
  const tf1: MessageEvent<FrameTransform> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: "map",
      child_frame_id: "base_link",
      translation: { x: 1e7, y: 0, z: 0 },
      rotation: QUAT_IDENTITY,
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };

  const count = 50;

  const ranges = new Float32Array(count);
  const intensities = new Float32Array(count);
  const pointCloudData = new Float32Array(4 * count);
  const angleMax = Math.PI / 4;
  const radius = 2;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    ranges[i] = radius / Math.cos(angleMax * t);
    intensities[i] = t;
    pointCloudData[4 * i + 0] = 1; // x
    pointCloudData[4 * i + 1] = radius * t; // y
    pointCloudData[4 * i + 2] = 0; // z
    pointCloudData[4 * i + 3] = t; // intensity
  }

  const laserScan: MessageEvent<LaserScan> = {
    topic: "/scan",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "base_link",
      pose: emptyPose(),
      start_angle: 0,
      end_angle: angleMax,
      ranges: ranges as unknown as number[],
      intensities: intensities as unknown as number[],
    },
    schemaName: "foxglove.LaserScan",
    sizeInBytes: 0,
  };

  const pointCloud: MessageEvent<PointCloud> = {
    topic: "/cloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "base_link",
      pose: emptyPose(),
      point_stride: 16,
      fields: [
        { name: "x", offset: 0, type: 7 },
        { name: "y", offset: 4, type: 7 },
        { name: "z", offset: 8, type: 7 },
        { name: "intensity", offset: 12, type: 7 },
      ],
      data: new Uint8Array(
        pointCloudData.buffer,
        pointCloudData.byteOffset,
        pointCloudData.byteLength,
      ),
    },
    schemaName: "foxglove.PointCloud",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/scan": [laserScan],
      "/cloud": [pointCloud],
      "/tf": [tf1],
    },
    capabilities: [],
    activeData: {
      currentTime: fromSec(0),
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          scene: { enableStats: false },
          topics: {
            "/scan": {
              visible: true,
              pointSize: 10,
              colorMode: "colormap",
              colorMap: "turbo",
              colorField: "intensity",
            },
            "/cloud": {
              visible: true,
              pointSize: 10,
              colorMode: "colormap",
              colorMap: "turbo",
              colorField: "intensity",
            },
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 5,
            perspective: false,
            phi: rad2deg(0),
            targetOffset: [0, 1, 0],
            thetaOffset: rad2deg(0),
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
