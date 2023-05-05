// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { fireEvent, screen, userEvent } from "@storybook/testing-library";

import { CompressedImage, RawImage } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import delay from "@foxglove/studio-base/util/delay";

import { ImagePanel, ThreeDeePanel } from "../../index";
import { CameraInfo, CompressedImage as RosCompressedImage, Image as RosRawImage } from "../../ros";
import { PNG_TEST_IMAGE, rad2deg, SENSOR_FRAME_ID } from "../common";

export default {
  title: "panels/ThreeDeeRender/Images",
  component: ThreeDeePanel,
  parameters: { colorScheme: "light" },
};

const ImageModeRosImage = ({ imageType }: { imageType: "raw" | "png" }) => {
  const topics: Topic[] = [
    { name: "/cam1/info", schemaName: "foxglove.CameraCalibration" },
    { name: "/cam2/info", schemaName: "foxglove.CameraCalibration" },
    { name: "/cam1/png", schemaName: "foxglove.CompressedImage" },
    { name: "/cam2/raw", schemaName: "foxglove.RawImage" },
  ];

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

  const cam1Png: MessageEvent<Partial<RosCompressedImage>> = {
    topic: "/cam1/png",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: SENSOR_FRAME_ID },
      format: "png",
      data: PNG_TEST_IMAGE,
    },
    schemaName: "sensor_msgs/CompressedImage",
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

  const cam2Raw: MessageEvent<Partial<RosRawImage>> = {
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

  const fixture: Fixture = {
    topics,
    frame: {
      "/cam1/info": [cam1],
      "/cam2/info": [cam2],
      "/cam1/png": [cam1Png],
      "/cam2/raw": [cam2Raw],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  };

  return (
    <PanelSetup fixture={fixture}>
      <ImagePanel
        overrideConfig={{
          ...ImagePanel.defaultConfig,
          followTf: undefined,
          scene: {
            transforms: {
              showLabel: false,
              axisScale: 0,
            },
          },
          imageMode: {
            calibrationTopic: imageType === "raw" ? "/cam2/info" : "/cam1/info",
            imageTopic: imageType === "raw" ? "/cam2/raw" : "/cam1/png",
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
        }}
      />
    </PanelSetup>
  );
};

export const ImageModeRosRawImage: StoryObj = {
  render: () => <ImageModeRosImage imageType="raw" />,
};

export const ImageModeRosPngImage: StoryObj = {
  render: () => <ImageModeRosImage imageType="png" />,
};

const ImageModeFoxgloveImage = ({ imageType }: { imageType: "raw" | "png" }) => {
  const topics: Topic[] = [
    { name: "/cam1/info", schemaName: "foxglove.CameraCalibration" },
    { name: "/cam2/info", schemaName: "foxglove.CameraCalibration" },
    { name: "/cam1/png", schemaName: "foxglove.CompressedImage" },
    { name: "/cam2/raw", schemaName: "foxglove.RawImage" },
  ];

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
    schemaName: "foxglove.RawImage",
    sizeInBytes: 0,
  };

  const fixture: Fixture = {
    topics,
    frame: {
      "/cam1/info": [cam1],
      "/cam2/info": [cam2],
      "/cam1/png": [cam1Png],
      "/cam2/raw": [cam2Raw],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  };
  return (
    <PanelSetup fixture={fixture}>
      <ImagePanel
        overrideConfig={{
          ...ImagePanel.defaultConfig,
          followTf: undefined,
          scene: {
            transforms: {
              axisScale: 0,
              showLabel: false,
            },
          },
          imageMode: {
            calibrationTopic: imageType === "raw" ? "/cam2/info" : "/cam1/info",
            imageTopic: imageType === "raw" ? "/cam2/raw" : "/cam1/png",
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
        }}
      />
    </PanelSetup>
  );
};

export const ImageModeFoxgloveRawImage: StoryObj = {
  render: () => <ImageModeFoxgloveImage imageType="raw" />,
};

export const ImageModeFoxglovePngImage: StoryObj = {
  render: () => <ImageModeFoxgloveImage imageType="png" />,
};

export const ImageModeResizeHandled: StoryObj = {
  render: () => <ImageModeFoxgloveImage imageType="raw" />,

  play: async () => {
    const canvas = document.querySelector("canvas")!;
    // Input attaches resize listener to parent element, so we need to resize that.
    const parentEl = canvas.parentElement!;
    await delay(30);
    parentEl.style.width = "50%";
    canvas.dispatchEvent(new Event("resize"));
    await delay(30);
  },
};

export const ImageModePan: StoryObj = {
  render: () => <ImageModeFoxgloveImage imageType="raw" />,
  play: async () => {
    const canvas = document.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(canvas, { clientX: 400, clientY: 200 });
    fireEvent.mouseUp(canvas, { clientX: 400, clientY: 200 });
  },
};

export const ImageModeZoomThenPan: StoryObj = {
  render: () => <ImageModeFoxgloveImage imageType="raw" />,
  play: async () => {
    const canvas = document.querySelector("canvas")!;
    fireEvent.wheel(canvas, { deltaY: -30, clientX: 400, clientY: 400 });
    fireEvent.wheel(canvas, { deltaY: -30, clientX: 400, clientY: 400 });
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(canvas, { clientX: 400, clientY: 200 });
    fireEvent.mouseUp(canvas, { clientX: 400, clientY: 200 });
  },
};

export const ImageModePanThenZoom: StoryObj = {
  render: () => <ImageModeFoxgloveImage imageType="raw" />,
  play: async () => {
    const canvas = document.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(canvas, { clientX: 400, clientY: 200 });
    fireEvent.mouseUp(canvas, { clientX: 400, clientY: 200 });
    fireEvent.wheel(canvas, { deltaY: -30, clientX: 400, clientY: 400 });
    fireEvent.wheel(canvas, { deltaY: -30, clientX: 400, clientY: 400 });
  },
};

export const ImageModePanThenZoomReset: StoryObj = {
  render: () => <ImageModeFoxgloveImage imageType="raw" />,
  play: async (ctx) => {
    await ImageModePanThenZoom.play?.(ctx);
    userEvent.click(await screen.findByTestId("reset-view"));
  },
};

export const ImageModePick: StoryObj = {
  render: () => <ImageModeFoxgloveImage imageType="raw" />,

  play: async () => {
    const canvas = document.querySelector("canvas")!;
    const inspectObjects = screen.getByRole("button", { name: /inspect objects/i });
    userEvent.click(inspectObjects);
    await delay(30);
    userEvent.click(canvas, { clientX: 500, clientY: 500 });
    await delay(30);
  },
};
