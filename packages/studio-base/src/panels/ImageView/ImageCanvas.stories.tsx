// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Story } from "@storybook/react";
import { range, noop } from "lodash";
import { useMemo } from "react";

import ImageView, { Config } from "@foxglove/studio-base/panels/ImageView";
import ImageCanvas from "@foxglove/studio-base/panels/ImageView/ImageCanvas";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";
import { CameraInfo, ImageMarker } from "@foxglove/studio-base/types/Messages";

const cameraInfo: CameraInfo = {
  width: 400,
  height: 300,
  distortion_model: "plumb_bob",
  D: [-0.437793, 0.183639, -0.003738, -0.001327, 0],
  K: [2339.067676, 0, 903.297282, 0, 2323.624869, 566.425547, 0, 0, 1],
  R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  P: [2170.145996, 0, 899.453592, 0, 0, 2275.496338, 568.217702, 0, 0, 0, 1, 0],
  binning_x: 1,
  binning_y: 1,
  roi: {
    x_offset: 0,
    y_offset: 0,
    height: 0,
    width: 0,
    do_rectify: false,
  },
};

const imageFormat = "image/png";

function useImageMessage() {
  const [imageData, setImageData] = React.useState<Uint8Array | undefined>();
  React.useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const gradient = ctx.createLinearGradient(0, 0, 400, 300);
    gradient.addColorStop(0, "cyan");
    gradient.addColorStop(1, "green");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 300);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "red";
    ctx.strokeRect(0, 0, 400, 300);
    canvas.toBlob((blob) => {
      blob?.arrayBuffer().then((arrayBuffer) => {
        setImageData(new Uint8Array(arrayBuffer));
      });
    }, imageFormat);
  }, []);

  return useMemo(() => {
    if (!imageData) {
      return;
    }

    return {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: imageFormat, data: imageData },
    };
  }, [imageData]);
}

function marker(
  type: ImageMarker["type"],
  props: Partial<ImageMarker> = {},
): MessageEvent<ImageMarker> {
  return {
    topic: "/foo",
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
      ns: "",
      id: 0,
      action: 0,
      position: { x: 0, y: 0, z: 0 },
      scale: 0,
      lifetime: { sec: 0, nsec: 0 },
      outline_color: { r: 0, g: 0, b: 0, a: 0 },
      filled: false,
      fill_color: { r: 0, g: 0, b: 0, a: 0 },
      points: [],
      outline_colors: [],
      text: { data: "" },
      thickness: 0,
      ...props,
      type,
    },
  };
}

function makeLines(xOffset: number) {
  return [
    { x: xOffset + 30, y: 50, z: 0 },
    { x: xOffset + 32, y: 58, z: 0 },
    { x: xOffset + 45, y: 47, z: 0 },
    { x: xOffset + 60, y: 50, z: 0 },
    { x: xOffset + 65, y: 40, z: 0 },
    { x: xOffset + 40, y: 45, z: 0 },
  ];
}

const markers = [
  // circles
  marker(0, {
    position: { x: 40, y: 20, z: 0 },
    scale: 5,
    thickness: 2,
    outline_color: { r: 255, g: 127, b: 0, a: 255 },
  }),
  marker(0, {
    position: { x: 55, y: 20, z: 0 },
    scale: 5,
    thickness: -1,
    outline_color: { r: 255, g: 0, b: 255, a: 255 },
  }),
  marker(1, {
    thickness: 1,
    points: [
      { x: 40, y: 20, z: 0 },
      { x: 40, y: 30, z: 0 },
      { x: 30, y: 30, z: 0 },
    ],
    outline_color: { r: 0, g: 0, b: 255, a: 255 },
  }), // line strip
  marker(1, {
    thickness: 2,
    points: makeLines(0),
    outline_color: { r: 255, g: 255, b: 255, a: 255 },
  }), // line list
  marker(2, {
    thickness: 2,
    points: makeLines(50),
    outline_color: { r: 127, g: 127, b: 255, a: 255 },
  }), // polygon
  marker(3, {
    thickness: 2,
    points: makeLines(100),
    outline_color: { r: 127, g: 127, b: 255, a: 255 },
  }),
  marker(3, {
    thickness: -10,
    points: makeLines(150),
    outline_color: { r: 127, g: 255, b: 127, a: 255 },
  }),
  marker(3, {
    thickness: -10,
    points: [
      { x: 100, y: 20, z: 0 },
      { x: 120, y: 20, z: 0 },
      { x: 120, y: 30, z: 0 },
      { x: 100, y: 30, z: 0 },
    ],
    outline_color: { r: 127, g: 255, b: 127, a: 255 },
  }),
  marker(3, {
    thickness: 1,
    points: [
      { x: 100, y: 20, z: 0 },
      { x: 120, y: 20, z: 0 },
      { x: 120, y: 30, z: 0 },
      { x: 100, y: 30, z: 0 },
    ],
    outline_color: { r: 0, g: 0, b: 0, a: 255 },
  }),
  marker(3, {
    thickness: -10,
    points: [
      { x: 150, y: 20, z: 0 },
      { x: 170, y: 20, z: 0 },
      { x: 170, y: 30, z: 0 },
      { x: 150, y: 30, z: 0 },
    ],
    outline_color: { r: 127, g: 255, b: 127, a: 255 },
  }), // points
  marker(4, {
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 130 + 10 * Math.sin(i / 2), z: 0 })),
    fill_color: { r: 255, g: 0, b: 0, a: 255 },
  }),
  marker(4, {
    scale: 1,
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 150 + 10 * Math.sin(i / 2), z: 0 })),
    fill_color: { r: 127, g: 255, b: 0, a: 255 },
  }),
  marker(4, {
    scale: 2,
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 170 + 10 * Math.sin(i / 2), z: 0 })),
    fill_color: { r: 0, g: 0, b: 255, a: 255 },
  }),
  marker(4, {
    scale: 2,
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 190 + 10 * Math.sin(i / 2), z: 0 })),
    outline_colors: range(50).map((i) => ({
      r: Math.round(255 * Math.min(1, (2 * i) / 50)),
      g: Math.round(255 * Math.min(1, (2 * (i - 15)) / 50)),
      b: Math.round(255 * Math.min(1, (2 * (i - 30)) / 50)),
      a: 255,
    })),
    fill_color: { r: 0, g: 0, b: 255, a: 255 },
  }), // text
  marker(5, {
    text: { data: "Hello!" },
    position: { x: 30, y: 100, z: 0 },
    scale: 1,
    outline_color: { r: 255, g: 127, b: 127, a: 255 },
  }),
  marker(5, {
    text: { data: "Hello!" },
    position: { x: 130, y: 100, z: 0 },
    scale: 1,
    outline_color: { r: 255, g: 127, b: 127, a: 255 },
    filled: true,
    fill_color: { r: 50, g: 50, b: 50, a: 255 },
  }),
  marker(0, {
    position: { x: 30, y: 100, z: 0 },
    scale: 2,
    thickness: -1,
    outline_color: { r: 255, g: 255, b: 0, a: 255 },
  }),
  marker(0, {
    position: { x: 130, y: 100, z: 0 },
    scale: 2,
    thickness: -1,
    outline_color: { r: 255, g: 255, b: 0, a: 255 },
  }),
];

const noMarkersMarkerData = {
  markers: [],
  cameraInfo: undefined,
  scale: 1,
  transformMarkers: false,
};

const topics = [
  { name: "/storybook_image", datatype: "sensor_msgs/Image" },
  { name: "/storybook_compressed_image", datatype: "sensor_msgs/CompressedImage" },
];
const config: Config = { ...ImageView.defaultConfig, mode: "fit" };

function RGBStory({ encoding }: { encoding: string }) {
  const width = 2560;
  const height = 2000;
  const data = new Uint8Array(3 * height * width);
  let idx = 0;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const r = Math.max(0, 1 - Math.hypot(1 - row / height, col / width)) * 256;
      const g = Math.max(0, 1 - Math.hypot(row / height, 1 - col / width)) * 256;
      const b = Math.max(0, 1 - Math.hypot(1 - row / height, 1 - col / width)) * 256;
      data[idx++] = encoding === "bgr8" ? b : r;
      data[idx++] = g;
      data[idx++] = encoding === "bgr8" ? r : b;
    }
  }
  return (
    <ImageCanvas
      topic={topics[0]}
      image={{
        topic: "/foo",
        receiveTime: { sec: 0, nsec: 0 },
        message: { data, width, height, encoding },
      }}
      rawMarkerData={noMarkersMarkerData}
      config={config}
      saveConfig={noop}
      onStartRenderImage={() => () => undefined}
    />
  );
}

function BayerStory({ encoding }: { encoding: string }) {
  const width = 2560;
  const height = 2000;
  const data = new Uint8Array(height * width);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const r = Math.max(0, 1 - Math.hypot(1 - row / height, col / width)) * 256;
      const g = Math.max(0, 1 - Math.hypot(row / height, 1 - col / width)) * 256;
      const b = Math.max(0, 1 - Math.hypot(1 - row / height, 1 - col / width)) * 256;
      switch (encoding) {
        case "bayer_rggb8":
          data[row * width + col] = row % 2 === 0 ? (col % 2 === 0 ? r : g) : col % 2 === 0 ? g : b;
          break;
        case "bayer_bggr8":
          data[row * width + col] = row % 2 === 0 ? (col % 2 === 0 ? b : g) : col % 2 === 0 ? g : r;
          break;
        case "bayer_gbrg8":
          data[row * width + col] = row % 2 === 0 ? (col % 2 === 0 ? g : b) : col % 2 === 0 ? r : g;
          break;
        case "bayer_grbg8":
          data[row * width + col] = row % 2 === 0 ? (col % 2 === 0 ? g : r) : col % 2 === 0 ? b : g;
          break;
      }
    }
  }
  return (
    <ImageCanvas
      topic={topics[0]}
      image={{
        topic: "/foo",
        receiveTime: { sec: 0, nsec: 0 },
        message: { data, width, height, encoding },
      }}
      rawMarkerData={noMarkersMarkerData}
      config={config}
      saveConfig={noop}
      onStartRenderImage={() => () => undefined}
    />
  );
}

function Mono16Story({
  bigEndian,
  minValue,
  maxValue,
}: {
  minValue?: number;
  maxValue?: number;
  bigEndian: boolean;
}) {
  const width = 2000;
  const height = 1000;
  const data = new Uint8Array(width * height * 2);
  const view = new DataView(data.buffer);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const val = Math.round(Math.min(1, Math.hypot(c / width, r / height)) * 10000);
      view.setUint16(2 * (r * width + c), val, !bigEndian);
    }
  }
  return (
    <ImageCanvas
      topic={topics[0]}
      image={{
        topic: "/foo",
        receiveTime: { sec: 0, nsec: 0 },
        message: { data, width, height, encoding: "16UC1", is_bigendian: bigEndian ? 1 : 0 },
      }}
      rawMarkerData={noMarkersMarkerData}
      config={{ ...config, minValue, maxValue }}
      saveConfig={noop}
      onStartRenderImage={() => () => undefined}
    />
  );
}

function ShouldCallOnRenderImage({
  children,
}: {
  children: (arg0: () => () => void) => React.ReactNode;
}) {
  const [callsOnStartRenderImage, setCallsOnStartRenderImage] = React.useState(false);
  const [callsOnFinishRenderImage, setCallsOnFinishRenderImage] = React.useState(false);
  const onStartRenderImage = React.useCallback(() => {
    if (!callsOnStartRenderImage) {
      setCallsOnStartRenderImage(true);
    }
    return () => {
      if (!callsOnFinishRenderImage) {
        setCallsOnFinishRenderImage(true);
      }
    };
  }, [
    callsOnStartRenderImage,
    callsOnFinishRenderImage,
    setCallsOnStartRenderImage,
    setCallsOnFinishRenderImage,
  ]);

  const hasPassed = callsOnStartRenderImage && callsOnFinishRenderImage;
  return (
    <div>
      <div style={{ fontSize: 18, padding: 16 }}>{hasPassed ? "SUCCESS" : "FAIL"}</div>
      {!hasPassed && children(onStartRenderImage)}
    </div>
  );
}

export default {
  title: "panels/ImageView/ImageCanvas",
  component: ImageCanvas,
  parameters: {
    chromatic: {
      delay: 2500,
    },
    colorScheme: "dark",
  },
};

export const MarkersOriginal: Story = (_args) => {
  const imageMessage = useImageMessage();
  const readySignal = useReadySignal();

  return (
    <div style={{ height: "400px" }}>
      <ImageCanvas
        topic={topics[1]}
        image={imageMessage}
        rawMarkerData={{
          markers,
          cameraInfo: undefined,
          transformMarkers: false,
        }}
        config={config}
        saveConfig={noop}
        onStartRenderImage={() => readySignal}
      />
    </div>
  );
};

MarkersOriginal.parameters = {
  useReadySignal: true,
};

export const MarkersTransformed: Story = (_args) => {
  const imageMessage = useImageMessage();
  const readySignal = useReadySignal();

  return (
    <div style={{ height: "400px" }}>
      <ImageCanvas
        topic={topics[1]}
        image={imageMessage}
        rawMarkerData={{
          markers,
          cameraInfo,
          transformMarkers: true,
        }}
        config={config}
        saveConfig={noop}
        onStartRenderImage={() => readySignal}
      />
    </div>
  );
};

MarkersTransformed.parameters = {
  useReadySignal: true,
};

// markers with different original image size
export const MarkersImageSize: Story = (_args) => {
  const imageMessage = useImageMessage();
  const readySignal = useReadySignal();

  return (
    <div style={{ height: "400px" }}>
      <ImageCanvas
        topic={topics[1]}
        image={imageMessage}
        rawMarkerData={{
          markers,
          cameraInfo: { ...cameraInfo, width: 200, height: 150 },
          transformMarkers: true,
        }}
        config={config}
        saveConfig={noop}
        onStartRenderImage={() => readySignal}
      />
    </div>
  );
};

MarkersImageSize.parameters = {
  useReadySignal: true,
};

export const MarkersWithFallbackRenderingUsingMainThread = (): JSX.Element => {
  const imageMessage = useImageMessage();

  return (
    <div>
      <div>original markers</div>
      <ImageCanvas
        topic={topics[1]}
        image={imageMessage}
        rawMarkerData={{
          markers,
          cameraInfo: undefined,
          transformMarkers: false,
        }}
        config={config}
        saveConfig={noop}
        renderInMainThread
        onStartRenderImage={() => () => undefined}
      />
      <br />
      <div>transformed markers</div>
      <ImageCanvas
        topic={topics[1]}
        image={imageMessage}
        rawMarkerData={{
          markers,
          cameraInfo,
          transformMarkers: true,
        }}
        config={config}
        saveConfig={noop}
        renderInMainThread
        onStartRenderImage={() => () => undefined}
      />
      <div>markers with different original image size</div>
      <ImageCanvas
        topic={topics[1]}
        image={imageMessage}
        rawMarkerData={{
          markers,
          cameraInfo: { ...cameraInfo, width: 200, height: 150 },
          transformMarkers: true,
        }}
        config={config}
        saveConfig={noop}
        renderInMainThread
        onStartRenderImage={() => () => undefined}
      />
    </div>
  );
};

export const ErrorState = (): JSX.Element => {
  return (
    <ImageCanvas
      topic={topics[0]}
      image={{
        topic: "/foo",
        receiveTime: { sec: 0, nsec: 0 },
        message: { data: new Uint8Array([]), width: 100, height: 50, encoding: "Foo" },
      }}
      rawMarkerData={noMarkersMarkerData}
      config={config}
      saveConfig={noop}
      onStartRenderImage={() => () => undefined}
    />
  );
};

export const CallsOnRenderFrameWhenRenderingSucceeds = (): JSX.Element => {
  const imageMessage = useImageMessage();

  return (
    <ShouldCallOnRenderImage>
      {(onStartRenderImage) => (
        <ImageCanvas
          topic={topics[0]}
          image={imageMessage}
          rawMarkerData={{
            markers,
            cameraInfo: undefined,
            transformMarkers: false,
          }}
          config={config}
          saveConfig={noop}
          onStartRenderImage={onStartRenderImage}
        />
      )}
    </ShouldCallOnRenderImage>
  );
};

export const CallsOnRenderFrameWhenRenderingFails = (): JSX.Element => {
  return (
    <ShouldCallOnRenderImage>
      {(onStartRenderImage) => (
        <ImageCanvas
          topic={topics[0]}
          image={{
            topic: "/foo",
            receiveTime: { sec: 0, nsec: 0 },
            message: { data: new Uint8Array([]), width: 100, height: 50, encoding: "Foo" },
          }}
          rawMarkerData={noMarkersMarkerData}
          config={config}
          saveConfig={noop}
          onStartRenderImage={onStartRenderImage}
        />
      )}
    </ShouldCallOnRenderImage>
  );
};

export const RGB8 = (): JSX.Element => <RGBStory encoding="rgb8" />;
export const BGR8 = (): JSX.Element => <RGBStory encoding="bgr8" />;

export const Mono16BigEndian = (): JSX.Element => <Mono16Story bigEndian={true} />;
export const Mono16LittleEndian = (): JSX.Element => <Mono16Story bigEndian={false} />;

const mono16Args = { minValue: 5000, maxValue: 20000 };
export const Mono16CustomMinMax = (args: typeof mono16Args): JSX.Element => (
  <Mono16Story bigEndian {...args} />
);
Mono16CustomMinMax.args = mono16Args;

export const BayerRGGB8 = (): JSX.Element => <BayerStory encoding="bayer_rggb8" />;
export const BayerBGGR8 = (): JSX.Element => <BayerStory encoding="bayer_bggr8" />;
export const BayerGBRG8 = (): JSX.Element => <BayerStory encoding="bayer_gbrg8" />;
export const BayerGRBG8 = (): JSX.Element => <BayerStory encoding="bayer_grbg8" />;
