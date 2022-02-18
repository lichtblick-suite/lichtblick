// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useMemo } from "react";

import { NormalizedImageMessage } from "../types";

function useCompressedImage(): NormalizedImageMessage | undefined {
  const imageFormat = "image/png";

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
      void blob?.arrayBuffer().then((arrayBuffer) => {
        setImageData(new Uint8Array(arrayBuffer));
      });
    }, imageFormat);
  }, []);

  return useMemo(() => {
    if (!imageData) {
      return;
    }

    return {
      type: "compressed",
      stamp: { sec: 0, nsec: 0 },
      format: imageFormat,
      data: imageData,
    };
  }, [imageData]);
}

export { useCompressedImage };
