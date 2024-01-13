// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Theme } from "@mui/material";
import * as Comlink from "comlink";

import { Immutable } from "@foxglove/studio";
import { Bounds } from "@foxglove/studio-base/types/Bounds";

import { ChartRenderer, Dataset, HoverElement, Scale, UpdateAction } from "./ChartRenderer";
import type { Service } from "./ChartRenderer.worker";

// If the datasets builder is garbage collected we also need to cleanup the worker
// This registry ensures the worker is cleaned up when the builder is garbage collected
const registry = new FinalizationRegistry<Worker>((worker) => {
  worker.terminate();
});

export class OffscreenCanvasRenderer {
  #renderingWorker: Worker;
  #canvas: OffscreenCanvas;
  #remote: Promise<Comlink.RemoteObject<ChartRenderer>>;

  #theme: Theme;

  public constructor(canvas: OffscreenCanvas, theme: Theme) {
    this.#theme = theme;
    this.#canvas = canvas;
    this.#renderingWorker = new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL("./ChartRenderer.worker", import.meta.url),
    );

    const remote = Comlink.wrap<Service<Comlink.RemoteObject<ChartRenderer>>>(
      this.#renderingWorker,
    );

    // Set the promise without await so init creates only one instance of renderer even if called
    // twice.
    this.#remote = remote.init(
      Comlink.transfer(
        {
          canvas: this.#canvas,
          devicePixelRatio: window.devicePixelRatio,
          gridColor: this.#theme.palette.divider,
          tickColor: this.#theme.palette.text.secondary,
        },
        [this.#canvas],
      ),
    );

    registry.register(this, this.#renderingWorker);
  }

  public async update(action: Immutable<UpdateAction>): Promise<Bounds | undefined> {
    return await (await this.#remote).update(action);
  }

  public async getElementsAtPixel(pixel: { x: number; y: number }): Promise<HoverElement[]> {
    return await (await this.#remote).getElementsAtPixel(pixel);
  }

  public async updateDatasets(datasets: Dataset[]): Promise<Scale | undefined> {
    return await (await this.#remote).updateDatasets(datasets);
  }
}
