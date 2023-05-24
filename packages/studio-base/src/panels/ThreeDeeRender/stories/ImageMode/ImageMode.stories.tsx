// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";
import { useCallback, useState } from "react";

import {
  CompressedImage,
  ImageAnnotations,
  PointsAnnotationType,
  RawImage,
} from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";
import { makeImageAndCalibration } from "@foxglove/studio-base/panels/ThreeDeeRender/stories/ImageMode/imageCommon";
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

const ImageModeRosImage = ({ imageType }: { imageType: "raw" | "png" }): JSX.Element => {
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
      R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
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
      R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
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

export const ImageModeRosRawImage: StoryObj<React.ComponentProps<typeof ImageModeRosImage>> = {
  render: ImageModeRosImage,
  args: { imageType: "raw" },
};

export const ImageModeRosPngImage: StoryObj<React.ComponentProps<typeof ImageModeRosImage>> = {
  render: ImageModeRosImage,
  args: { imageType: "png" },
};

const ImageModeFoxgloveImage = ({
  imageType = "raw",
  rotation,
  onDownload,
  flipHorizontal = false,
  flipVertical = false,
}: {
  imageType?: "raw" | "png";
  rotation?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  onDownload?: (blob: Blob, fileName: string) => void;
}): JSX.Element => {
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
      R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
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
      R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
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
        onDownload={onDownload}
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
            rotation,
            flipHorizontal,
            flipVertical,
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

export const ImageModeFoxgloveRawImage: StoryObj<
  React.ComponentProps<typeof ImageModeFoxgloveImage>
> = {
  render: ImageModeFoxgloveImage,
  args: { imageType: "raw" },
};

export const ImageModeFoxglovePngImage: StoryObj<
  React.ComponentProps<typeof ImageModeFoxgloveImage>
> = {
  render: ImageModeFoxgloveImage,
  args: { imageType: "png" },
};

export const DownloadRawImage: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> = {
  render: function Story(args) {
    const [src, setSrc] = useState<string | undefined>();
    const [filename, setFilename] = useState<string | undefined>();
    const onDownload = useCallback((blob: Blob, fileName: string) => {
      setSrc(URL.createObjectURL(blob));
      setFilename(fileName);
    }, []);
    return (
      <Stack direction="row" fullHeight>
        <Stack style={{ width: "50%" }}>
          <ImageModeFoxgloveImage {...args} onDownload={onDownload} />
        </Stack>
        <Stack style={{ width: "50%" }} zeroMinWidth>
          <div>{filename == undefined ? "Not downloaded" : `Downloaded image: ${filename}`}</div>
          <img src={src} style={{ imageRendering: "pixelated", border: "1px solid red" }} />
        </Stack>
      </Stack>
    );
  },
  args: { imageType: "raw" },
  play: async () => {
    const canvas = document.querySelector("canvas")!;
    const inspectObjects = screen.getByRole("button", { name: /inspect objects/i });
    userEvent.click(inspectObjects);
    await delay(1000);
    const rect = canvas.getBoundingClientRect();
    userEvent.click(canvas, { clientX: rect.width / 2, clientY: rect.height / 2 });
    await delay(30);
    userEvent.click(await screen.findByText("Download"));
  },
};

export const DownloadPngImage: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> = {
  ...DownloadRawImage,
  args: { imageType: "png" },
};

export const DownloadPngImageFlipH: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> =
  {
    ...DownloadRawImage,
    args: { imageType: "png", flipHorizontal: true },
  };

export const DownloadPngImageFlipV: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> =
  {
    ...DownloadRawImage,
    args: { imageType: "png", flipVertical: true },
  };

export const DownloadPngImageFlipHV: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> =
  {
    ...DownloadRawImage,
    args: { imageType: "png", flipHorizontal: true, flipVertical: true },
  };

export const DownloadPngImage90: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> = {
  ...DownloadRawImage,
  args: { imageType: "png", rotation: 90 },
};

export const DownloadPngImage180: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> = {
  ...DownloadRawImage,
  args: { imageType: "png", rotation: 180 },
};

export const DownloadPngImage270: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> = {
  ...DownloadRawImage,
  args: { imageType: "png", rotation: 270 },
};

export const DownloadPngImage90FlipH: StoryObj<
  React.ComponentProps<typeof ImageModeFoxgloveImage>
> = {
  ...DownloadRawImage,
  args: { imageType: "png", rotation: 90, flipHorizontal: true },
};

export const DownloadPngImage90FlipV: StoryObj<
  React.ComponentProps<typeof ImageModeFoxgloveImage>
> = {
  ...DownloadRawImage,
  args: { imageType: "png", rotation: 90, flipVertical: true },
};

export const DownloadPngImage90FlipHV: StoryObj<
  React.ComponentProps<typeof ImageModeFoxgloveImage>
> = {
  ...DownloadRawImage,
  args: { imageType: "png", rotation: 90, flipHorizontal: true, flipVertical: true },
};

export const ImageModeResizeHandled: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> =
  {
    render: ImageModeFoxgloveImage,
    args: { imageType: "raw" },

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

export const ImageModePick: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> = {
  render: ImageModeFoxgloveImage,
  args: { imageType: "raw" },

  play: async () => {
    const canvas = document.querySelector("canvas")!;
    const inspectObjects = screen.getByRole("button", { name: /inspect objects/i });
    userEvent.click(inspectObjects);
    await delay(30);
    userEvent.click(canvas, { clientX: 500, clientY: 500 });
    await delay(30);
  },
};

const InvalidPinholeCamera = (): JSX.Element => {
  const width = 60;
  const height = 45;
  const { calibrationMessage, cameraMessage } = makeImageAndCalibration({
    width,
    height,
    frameId: "camera",
    imageTopic: "camera",
    calibrationTopic: "calibration",
  });

  // Invalid pinhole camera model
  calibrationMessage.message.P = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const annotationsMessage: MessageEvent<Partial<ImageAnnotations>> = {
    topic: "annotations",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      circles: [
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 20, y: 5 },
          diameter: 4,
          thickness: 1,
          fill_color: { r: 1, g: 0, b: 1, a: 1 },
          outline_color: { r: 1, g: 1, b: 0, a: 1 },
        },
      ],
      points: [
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.POINTS,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 8 },
            { x: 2, y: 6 },
            { x: 5, y: 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
      ],
      texts: [
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 20, y: 30 },
          text: "Hi",
          font_size: 5,
          text_color: { r: 1, g: 0, b: 0, a: 1 },
          background_color: { r: 1, g: 1, b: 0, a: 1 },
        },
      ],
    },
    schemaName: "foxglove.ImageAnnotations",
    sizeInBytes: 0,
  };

  const fixture: Fixture = {
    topics: [
      { name: "calibration", schemaName: "foxglove.CameraCalibration" },
      { name: "camera", schemaName: "foxglove.RawImage" },
      { name: "annotations", schemaName: "foxglove.ImageAnnotations" },
    ],
    frame: {
      calibration: [calibrationMessage],
      camera: [cameraMessage],
      annotations: [annotationsMessage],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  };
  return (
    <PanelSetup fixture={fixture} includeSettings={true}>
      <ImagePanel
        overrideConfig={{
          ...ImagePanel.defaultConfig,
          imageMode: {
            calibrationTopic: "calibration",
            imageTopic: "camera",
            annotations: [
              {
                topic: "annotations",
                schemaName: "foxglove.ImageAnnotations",
                settings: { visible: true },
              },
            ],
          },
        }}
      />
    </PanelSetup>
  );
};

export const ImageModeInvalidCameraCalibration: StoryObj = {
  render: () => <InvalidPinholeCamera />,
  play: async () => {
    const errorIcon = await screen.findByTestId("ErrorIcon");
    userEvent.hover(errorIcon);
  },
};
