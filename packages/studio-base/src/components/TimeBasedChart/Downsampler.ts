// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { iterateObjects } from "@foxglove/studio-base/components/Chart/datasets";
import { RpcScales } from "@foxglove/studio-base/components/Chart/types";

import { downsample } from "./downsample";
import { ChartDatasets, PlotViewport } from "./types";

type UpdateParams = {
  datasets?: ChartDatasets;
  datasetBounds?: PlotViewport;
  scales?: RpcScales;
};

/**
 * Track a dataset, some bounds, a viewport to perform downsampling
 */
export class Downsampler {
  #datasets: ChartDatasets = [];
  #datasetBounds?: PlotViewport;
  #scales?: RpcScales;

  /**
   * Update internal state for next downsample
   */
  public update(opt: UpdateParams): void {
    this.#datasets = opt.datasets ?? this.#datasets;
    this.#datasetBounds = opt.datasetBounds ?? this.#datasetBounds;
    this.#scales = opt.scales ?? this.#scales;
  }

  /**
   * Perform a downsample with the latest state
   */
  public downsample(): ChartDatasets | undefined {
    const width = this.#datasetBounds?.width;
    const height = this.#datasetBounds?.width;

    const currentScales = this.#scales;
    let bounds:
      | {
          width: number;
          height: number;
          x: { min: number; max: number };
          y: { min: number; max: number };
        }
      | undefined = undefined;
    if (currentScales?.x && currentScales.y) {
      bounds = {
        width: width ?? 0,
        height: height ?? 0,
        x: {
          min: currentScales.x.min,
          max: currentScales.x.max,
        },
        y: {
          min: currentScales.y.min,
          max: currentScales.y.max,
        },
      };
    }

    if (this.#datasetBounds == undefined) {
      return undefined;
    }

    const { bounds: dataBounds } = this.#datasetBounds;
    const view: PlotViewport = {
      width: 0,
      height: 0,
      bounds: dataBounds,
    };

    return this.#datasets.map((dataset) => {
      if (!bounds) {
        return dataset;
      }

      const downsampled = downsample(dataset, iterateObjects(dataset.data), view);
      const resolved = downsampled.map((i) => dataset.data[i]);

      // NaN item values create gaps in the line
      const undefinedToNanData = resolved.map((item) => {
        if (item == undefined || isNaN(item.x) || isNaN(item.y)) {
          return { x: NaN, y: NaN, value: NaN };
        }
        return item;
      });

      return { ...dataset, data: undefinedToNanData };
    });
  }
}
