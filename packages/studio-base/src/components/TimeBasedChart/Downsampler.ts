// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RpcScales } from "@foxglove/studio-base/components/Chart/types";

import { downsampleScatter, downsampleTimeseries } from "./downsample";
import { ChartDatasets } from "./types";

type DatasetBounds = {
  x: { min?: number; max?: number };
  y: { min?: number; max?: number };
};

type UpdateParams = {
  datasets?: ChartDatasets;
  width?: number;
  height?: number;
  datasetBounds?: DatasetBounds;
  scales?: RpcScales;
};

/**
 * Track a dataset, some bounds, a viewport to perform downsampling
 */
export class Downsampler {
  #datasets: ChartDatasets = [];
  #width = 0;
  #height = 0;
  #datasetBounds?: DatasetBounds;
  #scales?: RpcScales;

  /**
   * Update internal state for next downsample
   */
  public update(opt: UpdateParams): void {
    this.#datasets = opt.datasets ?? this.#datasets;
    this.#width = opt.width ?? this.#width;
    this.#height = opt.height ?? this.#height;
    this.#datasetBounds = opt.datasetBounds ?? this.#datasetBounds;
    this.#scales = opt.scales ?? this.#scales;
  }

  /**
   * Perform a downsample with the latest state
   */
  public downsample(): ChartDatasets {
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
        width: this.#width,
        height: this.#height,
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

    const dataBounds = this.#datasetBounds;
    if (!dataBounds) {
      return [];
    }

    // if we don't have bounds (chart not initialized) but do have dataset bounds
    // then setup bounds as x/y min/max around the dataset values rather than the scales
    if (
      !bounds &&
      dataBounds.x.min != undefined &&
      dataBounds.x.max != undefined &&
      dataBounds.y.min != undefined &&
      dataBounds.y.max != undefined
    ) {
      bounds = {
        width: this.#width,
        height: this.#height,
        x: {
          min: dataBounds.x.min,
          max: dataBounds.x.max,
        },
        y: {
          min: dataBounds.y.min,
          max: dataBounds.y.max,
        },
      };
    }

    // If we don't have any bounds - we assume the component is still initializing and return no data
    // The other alternative is to return the full data set. This leads to rendering full fidelity data
    // which causes render pauses and blank charts for large data sets.
    if (!bounds) {
      return [];
    }

    return this.#datasets.map((dataset) => {
      if (!bounds) {
        return dataset;
      }

      const downsampled =
        dataset.showLine !== true
          ? downsampleScatter(dataset, bounds)
          : downsampleTimeseries(dataset, bounds);
      // NaN item values create gaps in the line
      const undefinedToNanData = downsampled.data.map((item) => {
        if (item == undefined || isNaN(item.x) || isNaN(item.y)) {
          return { x: NaN, y: NaN, value: NaN };
        }
        return item;
      });

      return { ...downsampled, data: undefinedToNanData };
    });
  }
}
