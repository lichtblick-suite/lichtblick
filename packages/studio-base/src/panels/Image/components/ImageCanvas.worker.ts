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

import Rpc, { Channel } from "@foxglove/studio-base/util/Rpc";
import { setupWorker } from "@foxglove/studio-base/util/RpcWorkerUtils";

import { renderImage } from "../lib/renderImage";
import { idColorToIndex } from "../lib/util";
import type { RenderArgs, RenderDimensions, Annotation } from "../types";

type RenderState = {
  canvas: OffscreenCanvas;
  dimensions?: RenderDimensions;
  hitmap: OffscreenCanvas;
  markers: Annotation[];
};

class ImageCanvasWorker {
  private readonly _renderStates: Record<string, RenderState> = {};

  public constructor(rpc: Rpc) {
    setupWorker(rpc);

    rpc.receive("initialize", async ({ id, canvas }: { id: string; canvas: OffscreenCanvas }) => {
      this._renderStates[id] = {
        canvas,
        hitmap: new OffscreenCanvas(canvas.width, canvas.height),
        markers: [],
      };
    });

    rpc.receive("mouseMove", async ({ id, x, y }: { id: string; x: number; y: number }) => {
      const state = this._renderStates[id];
      if (!state) {
        return undefined;
      }

      const matrix = (state.dimensions?.transform ?? new DOMMatrix()).inverse();
      const point = new DOMPoint(x, y).matrixTransform(matrix);
      // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1480
      const pixel = (
        state.canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | undefined
      )?.getImageData(x, y, 1, 1);
      const hit = (
        state.hitmap.getContext("2d") as OffscreenCanvasRenderingContext2D | undefined
      )?.getImageData(x, y, 1, 1);
      const markerIndex = hit ? idColorToIndex(hit.data) : undefined;

      if (pixel) {
        return {
          color: { r: pixel.data[0], g: pixel.data[1], b: pixel.data[2], a: pixel.data[3] },
          position: { x: Math.round(point.x), y: Math.round(point.y) },
          markerIndex,
          marker: markerIndex != undefined ? state.markers[markerIndex] : undefined,
        };
      } else {
        return undefined;
      }
    });

    rpc.receive(
      "renderImage",
      // Potentially performance-sensitive; await can be expensive
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      (args: RenderArgs & { id: string }): Promise<RenderDimensions | undefined> => {
        const { id, geometry, imageMessage, rawMarkerData, options } = args;

        const render = this._renderStates[id];
        if (!render) {
          return Promise.resolve(undefined);
        }

        if (render.canvas.width !== geometry.viewport.width) {
          render.canvas.width = geometry.viewport.width;
          render.hitmap.width = geometry.viewport.width;
        }

        if (render.canvas.height !== geometry.viewport.height) {
          render.canvas.height = geometry.viewport.height;
          render.hitmap.height = geometry.viewport.height;
        }

        render.markers = rawMarkerData.markers;

        return renderImage({
          canvas: render.canvas,
          geometry,
          hitmapCanvas: render.hitmap,
          imageMessage,
          options,
          rawMarkerData,
        }).then((dimensions) => (render.dimensions = dimensions));
      },
    );
  }
}

if ((global as unknown as Partial<Channel>).postMessage && !global.onmessage) {
  // not yet using TS Worker lib: FG-64
  new ImageCanvasWorker(new Rpc(global as unknown as Channel));
}
