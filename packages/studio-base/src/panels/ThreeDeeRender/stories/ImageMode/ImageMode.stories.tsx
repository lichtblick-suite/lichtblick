// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { fireEvent, screen, userEvent, waitFor } from "@storybook/testing-library";
import { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-use";
import tinycolor from "tinycolor2";

import {
  CameraCalibration,
  CompressedImage,
  ImageAnnotations,
  PointsAnnotation,
  PointsAnnotationType,
  RawImage,
} from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  makeCompressedImageAndCalibration,
  makeRawImageAndCalibration,
} from "@foxglove/studio-base/panels/ThreeDeeRender/stories/ImageMode/imageCommon";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import delay from "@foxglove/studio-base/util/delay";

import { ImagePanel } from "../../index";
import { CameraInfo, CompressedImage as RosCompressedImage, Image as RosRawImage } from "../../ros";
import { PNG_TEST_IMAGE, rad2deg, SENSOR_FRAME_ID } from "../common";

export default {
  title: "panels/ThreeDeeRender/Images",
  component: ImagePanel,
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
  onDownloadImage,
  flipHorizontal = false,
  flipVertical = false,
  minValue,
  maxValue,
}: {
  imageType?: "raw" | "png" | "raw_mono16";
  rotation?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  minValue?: number;
  maxValue?: number;
  onDownloadImage?: (blob: Blob, fileName: string) => void;
}): JSX.Element => {
  const topics: Topic[] = [
    { name: "/cam1/info", schemaName: "foxglove.CameraCalibration" },
    { name: "/cam2/info", schemaName: "foxglove.CameraCalibration" },
    { name: "/cam1/png", schemaName: "foxglove.CompressedImage" },
    { name: "/cam2/raw", schemaName: "foxglove.RawImage" },
    { name: "/mono16/raw", schemaName: "foxglove.RawImage" },
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

  let mono16Raw: MessageEvent<Partial<RawImage>>;
  {
    const width = 160;
    const height = 120;
    const mono16Data = new DataView(new ArrayBuffer(width * height * 2));
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const val = Math.round(
          65535 *
            (0.5 +
              0.25 * Math.sin((2 * Math.PI * r) / height) +
              0.25 * Math.sin(2 * Math.PI * (c / width))),
        );
        mono16Data.setUint16((r * width + c) * 2, val, true);
      }
    }
    mono16Raw = {
      topic: "/mono16/raw",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        timestamp: { sec: 0, nsec: 0 },
        frame_id: SENSOR_FRAME_ID,
        height,
        width,
        encoding: "16UC1",
        step: width * 2,
        data: new Uint8Array(mono16Data.buffer),
      },
      schemaName: "foxglove.RawImage",
      sizeInBytes: 0,
    };
  }

  const fixture: Fixture = {
    topics,
    frame: {
      "/cam1/info": [cam1],
      "/cam2/info": [cam2],
      "/cam1/png": [cam1Png],
      "/cam2/raw": [cam2Raw],
      "/mono16/raw": [mono16Raw],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  };

  let imageTopic: string;
  let calibrationTopic: string | undefined;
  switch (imageType) {
    case "raw":
      imageTopic = "/cam2/raw";
      calibrationTopic = "/cam2/info";
      break;
    case "png":
      imageTopic = "/cam1/png";
      calibrationTopic = "/cam1/info";
      break;
    case "raw_mono16":
      imageTopic = "/mono16/raw";
      break;
  }

  return (
    <PanelSetup fixture={fixture}>
      <ImagePanel
        onDownloadImage={onDownloadImage}
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
            calibrationTopic,
            imageTopic,
            rotation,
            flipHorizontal,
            flipVertical,
            minValue,
            maxValue,
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
    const onDownloadImage = useCallback((blob: Blob, fileName: string) => {
      setSrc(URL.createObjectURL(blob));
      setFilename(fileName);
    }, []);
    return (
      <Stack direction="row" fullHeight>
        <Stack style={{ width: "50%" }}>
          <ImageModeFoxgloveImage {...args} onDownloadImage={onDownloadImage} />
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
    const { click, pointer } = userEvent.setup();
    // need to wait until the images are done decoding
    await delay(500);
    await pointer({ target: document.querySelector("canvas")!, keys: "[MouseRight]" });
    const downloadButton = await screen.findByText("Download image");
    await click(downloadButton);
    // Add an extra delay after rendering the downloaded image to avoid flaky stores
    await delay(800);
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

export const DownloadMono16Image: StoryObj<React.ComponentProps<typeof ImageModeFoxgloveImage>> = {
  ...DownloadRawImage,
  args: { imageType: "raw_mono16" },
};
export const DownloadMono16ImageCustomMinMax: StoryObj<
  React.ComponentProps<typeof ImageModeFoxgloveImage>
> = {
  ...DownloadRawImage,
  args: { imageType: "raw_mono16", minValue: 10000, maxValue: 20000 },
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
    const { click, hover, pointer } = userEvent.setup();

    await hover(await screen.findByTestId(/panel-mouseenter-container/));
    const inspectObjects = screen.getByRole("button", { name: /inspect objects/i });
    await click(inspectObjects);

    await waitFor(
      async () => {
        await pointer({
          keys: "[MouseLeft]",
          target: document.querySelector("canvas")!,
          coords: { clientX: 500, clientY: 500 },
        });
        await screen.findByText("frame_id: sensor", undefined, { timeout: 10 });
      },
      { timeout: 1000 },
    );
  },
};

const InvalidPinholeCamera = (): JSX.Element => {
  const width = 60;
  const height = 45;
  const { calibrationMessage, cameraMessage } = makeRawImageAndCalibration({
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
            annotations: { annotations: { visible: true } },
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
    await userEvent.hover(errorIcon);
  },
};

export const UnsupportedEncodingError: StoryObj = {
  render: function Story() {
    const imageTopic = "camera";
    const topics: Topic[] = [{ name: imageTopic, schemaName: "foxglove.RawImage" }];

    const cameraMessage: MessageEvent<RawImage> = {
      topic: imageTopic,
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        timestamp: { sec: 10, nsec: 0 },
        frame_id: "camera",
        width: 10,
        height: 10,
        encoding: "nonsense",
        step: 1,
        data: new Uint8Array(),
      },
      schemaName: "foxglove.RawImage",
      sizeInBytes: 0,
    };

    const fixture: Fixture = {
      topics,
      frame: { [imageTopic]: [cameraMessage] },
      capabilities: [],
      activeData: { currentTime: { sec: 0, nsec: 0 } },
    };

    return (
      <PanelSetup fixture={fixture} includeSettings>
        <ImagePanel overrideConfig={{ ...ImagePanel.defaultConfig, imageMode: { imageTopic } }} />
      </PanelSetup>
    );
  },
  play: async () => {
    const errorIcon = await waitFor(async () => {
      const icons = await screen.findAllByTestId("ErrorIcon");
      if (icons.length !== 1) {
        throw new Error("Expected 1 error icon. (unsupported encoding)");
      }
      return icons[0];
    });
    await userEvent.hover(errorIcon!);
  },
};

export const DecompressionError: StoryObj = {
  render: function Story() {
    const imageTopic = "camera";
    const topics: Topic[] = [{ name: imageTopic, schemaName: "foxglove.CompressedImage" }];

    const cameraMessage: MessageEvent<CompressedImage> = {
      topic: imageTopic,
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        timestamp: { sec: 10, nsec: 0 },
        frame_id: "camera",
        format: "png",
        data: new TextEncoder().encode("this is not a png"),
      },
      schemaName: "foxglove.CompressedImage",
      sizeInBytes: 0,
    };

    const fixture: Fixture = {
      topics,
      frame: { [imageTopic]: [cameraMessage] },
      capabilities: [],
      activeData: { currentTime: { sec: 0, nsec: 0 } },
    };

    return (
      <PanelSetup fixture={fixture} includeSettings>
        <ImagePanel overrideConfig={{ ...ImagePanel.defaultConfig, imageMode: { imageTopic } }} />
      </PanelSetup>
    );
  },
  play: async () => {
    const errorIcon = await waitFor(async () => {
      const icons = await screen.findAllByTestId("ErrorIcon");
      if (icons.length !== 1) {
        throw new Error("Expected 1 error icon (decompression error)");
      }
      return icons[0];
    });
    await userEvent.hover(errorIcon!);
  },
};

export const LargeImage: StoryObj = {
  render: function Story() {
    const imageTopic = "camera";
    const topics: Topic[] = useMemo(
      () => [{ name: imageTopic, schemaName: "foxglove.CompressedImage" }],
      [],
    );

    const fixture = useAsync(async (): Promise<Fixture> => {
      const width = 1000;
      const height = 600;

      const { cameraMessage } = await makeCompressedImageAndCalibration({
        width,
        height,
        frameId: "camera",
        imageTopic,
        calibrationTopic: "calibration",
      });
      return {
        topics,
        frame: {
          [imageTopic]: [cameraMessage],
        },
        capabilities: [],
        activeData: {
          currentTime: { sec: 0, nsec: 0 },
        },
      };
    }, [topics]);

    return (
      <PanelSetup fixture={fixture.value}>
        <ImagePanel
          overrideConfig={{
            ...ImagePanel.defaultConfig,
            imageMode: { imageTopic },
          }}
        />
      </PanelSetup>
    );
  },
};

function makeYUYV(width: number, height: number) {
  const result = new Uint8Array(2 * width * height);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c += 2) {
      const y1 = r === c ? 255 : 127;
      const y2 = r === c + 1 ? 255 : 127;
      const u = Math.trunc(255 * (c / width));
      const v = Math.trunc(255 * (r / height));
      result[2 * (r * width + c) + 0] = y1;
      result[2 * (r * width + c) + 1] = u;
      result[2 * (r * width + c) + 2] = y2;
      result[2 * (r * width + c) + 3] = v;
    }
  }
  return result;
}

function makeUYVY(width: number, height: number) {
  const result = makeYUYV(width, height);
  for (let i = 0; i < result.length; i += 4) {
    const [y1, u, y2, v] = result.subarray(i, i + 4);
    result[i + 0] = u!;
    result[i + 1] = y1!;
    result[i + 2] = v!;
    result[i + 3] = y2!;
  }
  return result;
}

export const YUYV: StoryObj = {
  render: function Story() {
    const imageTopic = "camera";
    const topics: Topic[] = useMemo(
      () => [{ name: imageTopic, schemaName: "foxglove.RawImage" }],
      [],
    );

    const width = 200;
    const height = 150;
    const cameraMessage: MessageEvent<RawImage> = {
      topic: imageTopic,
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        timestamp: { sec: 10, nsec: 0 },
        frame_id: "camera",
        width,
        height,
        encoding: "yuyv",
        step: width * 2,
        data: makeYUYV(width, height),
      },
      schemaName: "foxglove.RawImage",
      sizeInBytes: 0,
    };

    const fixture: Fixture = {
      topics,
      frame: {
        [imageTopic]: [cameraMessage],
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
            imageMode: { imageTopic },
          }}
        />
      </PanelSetup>
    );
  },
};

export const UYVY: StoryObj = {
  render: function Story() {
    const imageTopic = "camera";
    const topics: Topic[] = useMemo(
      () => [{ name: imageTopic, schemaName: "foxglove.RawImage" }],
      [],
    );

    const width = 200;
    const height = 150;
    const cameraMessage: MessageEvent<RawImage> = {
      topic: imageTopic,
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        timestamp: { sec: 10, nsec: 0 },
        frame_id: "camera",
        width,
        height,
        encoding: "uyvy",
        step: width * 2,
        data: makeUYVY(width, height),
      },
      schemaName: "foxglove.RawImage",
      sizeInBytes: 0,
    };

    const fixture: Fixture = {
      topics,
      frame: {
        [imageTopic]: [cameraMessage],
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
            imageMode: { imageTopic },
          }}
        />
      </PanelSetup>
    );
  },
};

export const RationalPolynomialDistortion: StoryObj = {
  render: function Story() {
    const imageTopic = "camera";
    const calibrationTopic = "calibration";
    const annotationsTopic = "annotations";
    const topics: Topic[] = useMemo(
      () => [
        { name: imageTopic, schemaName: "foxglove.RawImage" },
        { name: calibrationTopic, schemaName: "foxglove.CameraCalibration" },
        { name: annotationsTopic, schemaName: "foxglove.ImageAnnotations" },
      ],
      [],
    );

    const width = 1928;
    const height = 1208;

    const fx = 1214.314459;
    const fy = 1214.314459;
    const cx = 964.3224501;
    const cy = 540.9620611;
    const k1 = 0.023768356069922447;
    const k2 = -0.31508326530456543;
    const p1 = -0.000028460506655392237;
    const p2 = -0.000457515794551;
    const k3 = -0.01789267733693123;
    const k4 = 0.4375666677951813;
    const k5 = -0.39708587527275085;
    const k6 = -0.10816607624292374;
    const calibrationMessage: MessageEvent<CameraCalibration> = {
      topic: calibrationTopic,
      schemaName: "foxglove.CameraCalibration",
      sizeInBytes: 0,
      receiveTime: { sec: 0, nsec: 0 },
      message: {
        timestamp: { sec: 0, nsec: 0 },
        width: 1928,
        height: 1208,
        frame_id: "cam",
        distortion_model: "rational_polynomial",
        K: [fx, 0, cx, 0, fy, cy, 0, 0, 1],
        P: [fx, 0, cx, 0, 0, fy, cy, 0, 0, 0, 1, 0],
        D: [k1, k2, p1, p2, k3, k4, k5, k6],
        R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      },
    };

    const getGridLineColor = (idx: number) => {
      if (idx % 200 === 199 || idx % 200 === 0 || idx % 200 === 1) {
        return 0;
      }
      if (idx % 50 === 0) {
        return 100;
      }
      return 127;
    };
    const imageData = new Uint8Array(width * height * 3);
    let i = 0;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (r === 0 || r === height - 1 || c === 0 || c === width - 1) {
          imageData[i] = 150;
          imageData[i + 1] = 150;
          imageData[i + 2] = 255;
          i += 3;
        } else {
          const color = getGridLineColor(r) + getGridLineColor(c);
          imageData[i] = color;
          imageData[i + 1] = color;
          imageData[i + 2] = color;
          i += 3;
        }
      }
    }

    const imageMessage: MessageEvent<RawImage> = {
      topic: imageTopic,
      schemaName: "foxglove.RawImage",
      sizeInBytes: 0,
      receiveTime: { sec: 0, nsec: 0 },
      message: {
        frame_id: "cam",
        timestamp: { sec: 0, nsec: 0 },
        width,
        height,
        step: width * 3,
        encoding: "rgb8",
        data: imageData,
      },
    };

    const lines: PointsAnnotation = {
      timestamp: { sec: 0, nsec: 0 },
      type: PointsAnnotationType.LINE_STRIP,
      points: [],
      thickness: 2,
      outline_color: { r: 0, g: 0.8, b: 0, a: 1 },
      outline_colors: [],
      fill_color: { r: 0, g: 0, b: 0, a: 0 },
    };
    const points: PointsAnnotation = {
      timestamp: { sec: 0, nsec: 0 },
      type: PointsAnnotationType.POINTS,
      points: [],
      thickness: 20,
      outline_color: { r: 0, g: 0, b: 0, a: 0 },
      outline_colors: [],
      fill_color: { r: 0, g: 0, b: 0, a: 0 },
    };
    const inset = 100;
    const rows = 5;
    const cols = 8;
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const x = inset + Math.round((width - 2 * inset) * (col / cols));
        const y = inset + Math.round((height - 2 * inset) * (row / rows));
        points.points.push({ x, y });
        lines.points.push({ x, y });
        const { r, g, b } = tinycolor({
          h: ((row / rows + col / cols) / 2) * 360,
          s: 100,
          v: 100,
        }).toRgb();
        points.outline_colors.push({ r: r / 255, g: g / 255, b: b / 255, a: 1 });
      }
    }
    const annotationsMessage: MessageEvent<ImageAnnotations> = {
      topic: "annotations",
      schemaName: "foxglove.ImageAnnotations",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      message: {
        points: [lines, points],
        circles: [],
        texts: [],
      },
    };

    const fixture: Fixture = {
      topics,
      frame: {
        [imageTopic]: [imageMessage],
        [calibrationTopic]: [calibrationMessage],
        [annotationsTopic]: [annotationsMessage],
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
            imageMode: {
              imageTopic,
              calibrationTopic,
              annotations: { [annotationsTopic]: { visible: true } },
            },
          }}
        />
      </PanelSetup>
    );
  },

  async play() {
    const canvas = document.querySelector("canvas")!;
    const rect = canvas.getBoundingClientRect();

    fireEvent.wheel(canvas, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      deltaY: 100,
    });
  },
};

const ImageModeEmptyLayout = ({
  type,
}: {
  type: "no-topics" | "no-messages" | "image-topic-DNE";
}): JSX.Element => {
  let fixture: Fixture | undefined;
  let calibrationTopic: string | undefined = "calibration";
  switch (type) {
    case "no-topics":
      fixture = {
        topics: [],
        frame: {},
        capabilities: [],
        activeData: {
          currentTime: { sec: 0, nsec: 0 },
        },
      };
      break;
    case "image-topic-DNE": {
      calibrationTopic = undefined;
      fixture = {
        topics: [],
        frame: {},
        capabilities: [],
        activeData: {
          currentTime: { sec: 0, nsec: 0 },
        },
      };
      break;
    }
    case "no-messages":
      fixture = {
        topics: [
          { name: "calibration", schemaName: "foxglove.CameraCalibration" },
          { name: "camera", schemaName: "foxglove.RawImage" },
        ],
        frame: {},
        capabilities: [],
        activeData: {
          currentTime: { sec: 0, nsec: 0 },
        },
      };
      break;
  }
  return (
    <PanelSetup fixture={fixture} includeSettings={true}>
      <ImagePanel
        overrideConfig={{
          ...ImagePanel.defaultConfig,
          imageMode: {
            calibrationTopic,
            imageTopic: "camera",
          },
        }}
      />
    </PanelSetup>
  );
};

export const ImageModeEmptyNoTopics: StoryObj<React.ComponentProps<typeof ImageModeEmptyLayout>> = {
  render: ImageModeEmptyLayout,
  args: { type: "no-topics" },
};

export const ImageModeEmptyNoMessages: StoryObj<React.ComponentProps<typeof ImageModeEmptyLayout>> =
  {
    render: ImageModeEmptyLayout,
    args: { type: "no-messages" },
  };

// when calibration == "None", then we display an empty state when only the image topic does not exist
export const ImageModeEmptyOnlyImageTopicDNE: StoryObj<
  React.ComponentProps<typeof ImageModeEmptyLayout>
> = {
  render: ImageModeEmptyLayout,
  args: { type: "image-topic-DNE" },
};
