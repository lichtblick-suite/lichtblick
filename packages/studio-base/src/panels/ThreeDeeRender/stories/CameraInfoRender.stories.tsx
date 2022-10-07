// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { CameraInfo, TransformStamped } from "../ros";
import {
  BASE_LINK_FRAME_ID,
  FIXED_FRAME_ID,
  QUAT_IDENTITY,
  rad2deg,
  SENSOR_FRAME_ID,
} from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

CameraInfoRender.parameters = { colorScheme: "dark" };
export function CameraInfoRender(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
    { name: "/rational_polynomial", schemaName: "sensor_msgs/CameraInfo" },
    { name: "/none", schemaName: "sensor_msgs/CameraInfo" },
    { name: "/empty", schemaName: "sensor_msgs/CameraInfo" },
  ];

  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: FIXED_FRAME_ID },
      child_frame_id: BASE_LINK_FRAME_ID,
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
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: BASE_LINK_FRAME_ID },
      child_frame_id: SENSOR_FRAME_ID,
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: { x: 0.383, y: 0, z: 0, w: 0.924 },
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };

  const cam1: MessageEvent<Partial<CameraInfo>> = {
    topic: "/rational_polynomial",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: 480,
      width: 640,
      distortion_model: "rational_polynomial",
      D: [0.452407, 0.273748, -0.00011, 0.000152, 0.027904, 0.817958, 0.358389, 0.108657],
      K: [
        381.22076416015625, 0, 318.88323974609375, 0, 381.22076416015625, 233.90321350097656, 0, 0,
        1,
      ],
      R: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      P: [
        381.22076416015625, 0, 318.88323974609375, 0.015031411312520504, 0, 381.22076416015625,
        233.90321350097656, -0.00011014656047336757, 0, 0, 1, 0.000024338871298823506,
      ],
    },
    schemaName: "sensor_msgs/CameraInfo",
    sizeInBytes: 0,
  };

  const cam2: MessageEvent<Partial<CameraInfo>> = {
    topic: "/none",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: 900,
      width: 1600,
      distortion_model: "",
      D: [],
      K: [
        1266.417203046554, 0, 816.2670197447984, 0, 1266.417203046554, 491.50706579294757, 0, 0, 1,
      ],
      R: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      P: [
        1266.417203046554, 0, 816.2670197447984, 0, 0, 1266.417203046554, 491.50706579294757, 0, 0,
        0, 1, 0,
      ],
    },
    schemaName: "sensor_msgs/CameraInfo",
    sizeInBytes: 0,
  };

  const cam3: MessageEvent<Partial<CameraInfo>> = {
    topic: "/empty",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: 1080,
      width: 1920,
    },
    schemaName: "sensor_msgs/CameraInfo",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/rational_polynomial": [cam1],
      "/none": [cam2],
      "/empty": [cam3],
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
          ...ThreeDeeRender.defaultConfig,
          followTf: SENSOR_FRAME_ID,
          cameraState: {
            distance: 1.85,
            perspective: true,
            phi: rad2deg(0),
            targetOffset: [0, 0, 0],
            thetaOffset: rad2deg(Math.PI),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/rational_polynomial": {
              visible: true,
              color: "rgba(0, 255, 0, 1)",
              distance: 0.25,
            },
            "/none": {
              visible: true,
              color: "rgba(0, 255, 255, 1)",
              distance: 0.5,
            },
            "/empty": {
              visible: true,
              color: "rgba(255, 0, 0, 1)",
              distance: 0.75,
            },
          },
        }}
      />
    </PanelSetup>
  );
}
