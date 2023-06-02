// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CameraCalibration, CompressedImage, RawImage } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";

type MakeImageArgs = {
  width: number;
  height: number;
  frameId: string;
  imageTopic: string;
  calibrationTopic: string;
  fx?: number;
  fy?: number;
};

// ts-prune-ignore-next
export function makeRawImageAndCalibration(args: MakeImageArgs): {
  calibrationMessage: MessageEvent<Partial<CameraCalibration>>;
  cameraMessage: MessageEvent<Partial<RawImage>>;
} {
  const { width, height, frameId, imageTopic, calibrationTopic, fx = 500, fy = 500 } = args;
  const cx = width / 2;
  const cy = height / 2;
  const calibrationMessage: MessageEvent<Partial<CameraCalibration>> = {
    topic: calibrationTopic,
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: frameId,
      height,
      width,
      distortion_model: "rational_polynomial",
      D: [],
      K: [fx, 0, cx, 0, fy, cy, 0, 0, 1],
      R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      P: [fx, 0, cx, 0, 0, fy, cy, 0, 0, 0, 1, 0],
    },
    schemaName: "foxglove.CameraCalibration",
    sizeInBytes: 0,
  };

  function getGridLineColor(idx: number) {
    if (idx % 10 === 0) {
      return 0;
    }
    if (idx % 2 === 0) {
      return 100;
    }
    return 127;
  }
  const imageData = new Uint8Array(width * height * 3);
  for (let i = 0, r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (r === 0 || r === height - 1 || c === 0 || c === width - 1) {
        imageData[i++] = 150;
        imageData[i++] = 150;
        imageData[i++] = 255;
      } else {
        imageData[i++] = getGridLineColor(r) + getGridLineColor(c);
        imageData[i++] = getGridLineColor(r) + getGridLineColor(c);
        imageData[i++] = getGridLineColor(r) + getGridLineColor(c);
      }
    }
  }

  const cameraMessage: MessageEvent<Partial<RawImage>> = {
    topic: imageTopic,
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: frameId,
      width,
      height,
      encoding: "rgb8",
      data: imageData,
    },
    schemaName: "foxglove.RawImage",
    sizeInBytes: 0,
  };

  return { calibrationMessage, cameraMessage };
}

// ts-prune-ignore-next
export async function makeCompressedImageAndCalibration(args: MakeImageArgs): Promise<{
  calibrationMessage: MessageEvent<Partial<CameraCalibration>>;
  cameraMessage: MessageEvent<Partial<CompressedImage>>;
}> {
  const { calibrationMessage, cameraMessage: rawCameraMessage } = makeRawImageAndCalibration(args);

  const canvas = document.createElement("canvas");
  canvas.width = args.width;
  canvas.height = args.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }
  const imageData = ctx.createImageData(args.width, args.height);
  for (let i = 0, j = 0; i < rawCameraMessage.message.data!.length; i += 3, j += 4) {
    imageData.data[j] = rawCameraMessage.message.data![i]!;
    imageData.data[j + 1] = rawCameraMessage.message.data![i + 1]!;
    imageData.data[j + 2] = rawCameraMessage.message.data![i + 2]!;
    imageData.data[j + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const imageBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject();
      } else {
        resolve(blob);
      }
    }, "image/png");
  });

  const buffer = await imageBlob.arrayBuffer();
  const cameraMessage: MessageEvent<Partial<CompressedImage>> = {
    topic: rawCameraMessage.topic,
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: rawCameraMessage.message.timestamp,
      frame_id: rawCameraMessage.message.frame_id,
      data: new Uint8Array(buffer),
      format: "png",
    },
    schemaName: "foxglove.CompressedImage",
    sizeInBytes: 0,
  };
  return { calibrationMessage, cameraMessage };
}
