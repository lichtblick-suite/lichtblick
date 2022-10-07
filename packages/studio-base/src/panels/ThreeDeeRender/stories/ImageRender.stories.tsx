// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CompressedImage, FrameTransform, RawImage } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { CameraInfo, CompressedImage as RosCompressedImage, Image, TransformStamped } from "../ros";
import {
  BASE_LINK_FRAME_ID,
  FIXED_FRAME_ID,
  PNG_TEST_IMAGE,
  QUAT_IDENTITY,
  rad2deg,
  SENSOR_FRAME_ID,
} from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

ImageRender.parameters = { colorScheme: "light" };
export function ImageRender(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
    { name: "/cam1/info", schemaName: "sensor_msgs/CameraInfo" },
    { name: "/cam2/info", schemaName: "sensor_msgs/CameraInfo" },
    { name: "/cam1/png", schemaName: "sensor_msgs/CompressedImage" },
    { name: "/cam2/raw", schemaName: "sensor_msgs/Image" },
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
    topic: "/cam1/info",
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
    topic: "/cam2/info",
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

  const cam1Png: MessageEvent<Partial<RosCompressedImage>> = {
    topic: "/cam1/png",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      format: "png",
      data: PNG_TEST_IMAGE,
    },
    schemaName: "sensor_msgs/CameraInfo",
    sizeInBytes: 0,
  };

  // Create a Uint8Array 8x8 RGBA image
  const SIZE = 8;
  const rgba8 = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      rgba8[i + 0] = Math.trunc((x / (SIZE - 1)) * 255);
      rgba8[i + 1] = Math.trunc((y / (SIZE - 1)) * 255);
      rgba8[i + 2] = 0;
      rgba8[i + 3] = 255;
    }
  }

  const cam2Raw: MessageEvent<Partial<Image>> = {
    topic: "/cam2/raw",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      height: SIZE,
      width: SIZE,
      encoding: "rgba8",
      is_bigendian: false,
      step: SIZE * 4,
      data: rgba8,
    },
    schemaName: "sensor_msgs/Image",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/cam1/info": [cam1],
      "/cam2/info": [cam2],
      "/cam1/png": [cam1Png],
      "/cam2/raw": [cam2Raw],
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
          scene: {
            labelScaleFactor: 0,
          },
          cameraState: {
            distance: 1.5,
            perspective: true,
            phi: rad2deg(0.975),
            targetOffset: [0, 0.4, 0],
            thetaOffset: rad2deg(0),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/cam1/info": {
              visible: true,
              color: "rgba(0, 255, 0, 1)",
              distance: 0.5,
            },
            "/cam2/info": {
              visible: true,
              color: "rgba(0, 255, 255, 1)",
              distance: 0.25,
            },
            "/cam1/png": {
              visible: true,
              color: "rgba(255, 255, 255, 1)",
              distance: 0.5,
            },
            "/cam2/raw": {
              visible: true,
              color: "rgba(255, 255, 255, 0.75)",
              distance: 0.25,
            },
          },
        }}
      />
    </PanelSetup>
  );
}

FoxgloveImageRender.parameters = { colorScheme: "light" };
export function FoxgloveImageRender(): JSX.Element {
  const topics: Topic[] = [
    { name: "/tf", schemaName: "foxglove.FrameTransform" },
    { name: "/cam1/info", schemaName: "foxglove.CameraCalibration" },
    { name: "/cam2/info", schemaName: "foxglove.CameraCalibration" },
    { name: "/cam1/png", schemaName: "foxglove.CompressedImage" },
    { name: "/cam2/raw", schemaName: "foxglove.RawImage" },
  ];

  const tf1: MessageEvent<FrameTransform> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: FIXED_FRAME_ID,
      child_frame_id: BASE_LINK_FRAME_ID,
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
      parent_frame_id: BASE_LINK_FRAME_ID,
      child_frame_id: SENSOR_FRAME_ID,
      translation: { x: 0, y: 0, z: 1 },
      rotation: { x: 0.383, y: 0, z: 0, w: 0.924 },
    },
    schemaName: "foxglove.FrameTransform",
    sizeInBytes: 0,
  };

  const cam1: MessageEvent<Partial<CameraInfo>> = {
    topic: "/cam1/info",
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
    schemaName: "foxglove.CameraCalibration",
    sizeInBytes: 0,
  };

  const cam2: MessageEvent<Partial<CameraInfo>> = {
    topic: "/cam2/info",
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
    schemaName: "foxglove.CameraCalibration",
    sizeInBytes: 0,
  };

  const cam1Png: MessageEvent<Partial<CompressedImage>> = {
    topic: "/cam1/png",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: SENSOR_FRAME_ID,
      format: "png",
      data: PNG_TEST_IMAGE,
    },
    schemaName: "foxglove.CompressedImage",
    sizeInBytes: 0,
  };

  // Create a Uint8Array 8x8 RGBA image
  const SIZE = 8;
  const rgba8 = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      rgba8[i + 0] = Math.trunc((x / (SIZE - 1)) * 255);
      rgba8[i + 1] = Math.trunc((y / (SIZE - 1)) * 255);
      rgba8[i + 2] = 0;
      rgba8[i + 3] = 255;
    }
  }

  const cam2Raw: MessageEvent<Partial<RawImage>> = {
    topic: "/cam2/raw",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: SENSOR_FRAME_ID,
      height: SIZE,
      width: SIZE,
      encoding: "rgba8",
      step: SIZE * 4,
      data: rgba8,
    },
    schemaName: "sensor_msgs/Image",
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/tf": [tf1, tf2],
      "/cam1/info": [cam1],
      "/cam2/info": [cam2],
      "/cam1/png": [cam1Png],
      "/cam2/raw": [cam2Raw],
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
          scene: {
            labelScaleFactor: 0,
          },
          cameraState: {
            distance: 1.5,
            perspective: true,
            phi: rad2deg(0.975),
            targetOffset: [0, 0.4, 0],
            thetaOffset: rad2deg(0),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/cam1/info": {
              visible: true,
              color: "rgba(0, 255, 0, 1)",
              distance: 0.5,
            },
            "/cam2/info": {
              visible: true,
              color: "rgba(0, 255, 255, 1)",
              distance: 0.25,
            },
            "/cam1/png": {
              visible: true,
              color: "rgba(255, 255, 255, 1)",
              distance: 0.5,
            },
            "/cam2/raw": {
              visible: true,
              color: "rgba(255, 255, 255, 0.75)",
              distance: 0.25,
            },
          },
        }}
      />
    </PanelSetup>
  );
}
