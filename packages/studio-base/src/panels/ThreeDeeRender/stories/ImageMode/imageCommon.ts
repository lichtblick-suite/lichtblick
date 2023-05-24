// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CameraCalibration, RawImage } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";

// ts-prune-ignore-next
export function makeImageAndCalibration(args: {
  width: number;
  height: number;
  frameId: string;
  imageTopic: string;
  calibrationTopic: string;
  fx?: number;
  fy?: number;
}): {
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

  const imageData = new Uint8Array(width * height * 3);
  for (let i = 0, r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (r === 0 || r === height - 1 || c === 0 || c === width - 1) {
        imageData[i++] = 150;
        imageData[i++] = 150;
        imageData[i++] = 255;
      } else {
        imageData[i++] = (r % 2 === 0 ? 127 : 0) + (c % 2 === 0 ? 127 : 0);
        imageData[i++] = (r % 2 === 0 ? 127 : 0) + (c % 2 === 0 ? 127 : 0);
        imageData[i++] = (r % 2 === 0 ? 127 : 0) + (c % 2 === 0 ? 127 : 0);
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
