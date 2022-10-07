// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Topic } from "@foxglove/studio-base/players/types";
import { downloadFiles } from "@foxglove/studio-base/util/download";

import { Config, NormalizedImageMessage } from "../types";
import { renderImage } from "./renderImage";

export async function downloadImage(
  normalizedImageMessage: NormalizedImageMessage,
  topic: Topic,
  config: Config,
): Promise<void> {
  // re-render the image onto a new canvas to download the original image
  const tempCanvas = document.createElement("canvas");
  const dimensions = await renderImage({
    canvas: tempCanvas,
    hitmapCanvas: undefined,
    geometry: {
      flipHorizontal: config.flipHorizontal ?? false,
      flipVertical: config.flipVertical ?? false,
      panZoom: { x: 0, y: 0, scale: 1 },
      rotation: config.rotation ?? 0,
      viewport: { width: 1, height: 1 }, // We'll just use the intrinsic image dimensions.
      zoomMode: "other",
    },
    imageMessage: normalizedImageMessage,
    rawMarkerData: { markers: [], transformMarkers: false },
    options: {
      imageSmoothing: config.smooth,
      minValue: config.minValue,
      maxValue: config.maxValue,
      resizeCanvas: true,
    },
  });

  if (!dimensions) {
    return;
  }

  // context: https://stackoverflow.com/questions/37135417/download-canvas-as-png-in-fabric-js-giving-network-error
  // read the canvas data as an image (png)
  return await new Promise((resolve) =>
    tempCanvas.toBlob((blob) => {
      if (!blob) {
        throw new Error(
          `Failed to create an image from ${dimensions.width}x${dimensions.height} canvas`,
        );
      }
      // name the image the same name as the topic
      // note: the / characters in the file name will be replaced with _ by the browser
      // remove any leading / so the image name doesn't start with _
      const topicName = topic.name.replace(/^\/+/, "");
      const stamp = normalizedImageMessage.stamp;
      const fileName = `${topicName}-${stamp.sec}-${stamp.nsec}`;
      downloadFiles([{ blob, fileName }]);
      resolve();
    }, "image/png"),
  );
}
