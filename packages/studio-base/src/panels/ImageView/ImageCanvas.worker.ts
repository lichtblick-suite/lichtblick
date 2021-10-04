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

import { Image, CompressedImage } from "@foxglove/studio-base/types/Messages";
import Rpc, { Channel } from "@foxglove/studio-base/util/Rpc";
import { setupWorker } from "@foxglove/studio-base/util/RpcWorkerUtils";

import { renderImage } from "./renderImage";
import { Dimensions, RawMarkerData, RenderOptions } from "./util";

class ImageCanvasWorker {
  private _idToCanvas: {
    [key: string]: OffscreenCanvas;
  } = {};

  constructor(rpc: Rpc) {
    setupWorker(rpc);

    rpc.receive("initialize", async ({ id, canvas }: { id: string; canvas: OffscreenCanvas }) => {
      this._idToCanvas[id] = canvas;
    });

    rpc.receive(
      "renderImage",
      // Potentially performance-sensitive; await can be expensive
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      (args: {
        id: string;
        zoomMode: "fit" | "fill" | "other";
        panZoom: { x: number; y: number; scale: number };
        viewport: { width: number; height: number };
        imageMessage?: Image | CompressedImage;
        imageMessageDatatype?: string;
        rawMarkerData: RawMarkerData;
        options: RenderOptions;
      }): Promise<Dimensions | undefined> => {
        const {
          id,
          zoomMode,
          panZoom,
          viewport,
          imageMessage,
          imageMessageDatatype,
          rawMarkerData,
          options,
        } = args;

        const canvas = this._idToCanvas[id];
        if (!canvas) {
          return Promise.resolve(undefined);
        }

        if (canvas.width !== viewport.width) {
          canvas.width = viewport.width;
        }

        if (canvas.height !== viewport.height) {
          canvas.height = viewport.height;
        }

        return renderImage({
          canvas,
          zoomMode,
          panZoom,
          imageMessage,
          imageMessageDatatype,
          rawMarkerData,
          options,
        });
      },
    );
  }
}

if ((global as unknown as Partial<Channel>).postMessage && !global.onmessage) {
  // not yet using TS Worker lib: FG-64
  new ImageCanvasWorker(new Rpc(global as unknown as Channel));
}
