// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable, Time } from "@lichtblick/suite";
import {
  MAX_POINTS,
  downsampleScatter,
  downsampleTimeseries,
} from "@lichtblick/suite-base/components/TimeBasedChart/downsample";
import { Bounds1D } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { extendBounds1D } from "@lichtblick/suite-base/types/Bounds";

import { CsvDataset, SeriesConfigKey, SeriesItem, Viewport } from "./IDatasetsBuilder";
import { Dataset } from "../types";
import { Datum } from "../utils/datum";

export type DataItem = Datum & {
  receiveTime: Time;
  headerStamp?: Time;
};

type FullDatum = Datum & {
  receiveTime: Time;
  headerStamp?: Time;
  index: number;
};

type Series = {
  config: Immutable<SeriesItem>;
  current: FullDatum[];
  full: FullDatum[];
};

type ResetSeriesFullAction = {
  type: "reset-full";
  series: SeriesConfigKey;
};

type ResetSeriesCurrentAction = {
  type: "reset-current";
  series: SeriesConfigKey;
};

type UpdateSeriesCurrentAction = {
  type: "append-current";
  series: SeriesConfigKey;
  items: DataItem[];
};

type UpdateSeriesFullAction = {
  type: "append-full";
  series: SeriesConfigKey;
  items: DataItem[];
};

type UpdateSeriesConfigAction = {
  type: "update-series-config";
  seriesItems: SeriesItem[];
};

export type UpdateDataAction =
  | UpdateSeriesConfigAction
  | ResetSeriesFullAction
  | ResetSeriesCurrentAction
  | UpdateSeriesCurrentAction
  | UpdateSeriesFullAction;

// When accumulating datums into the current buffer we cap each series to this number of datums so
// we do not grow the memory for accumulated current data indefinitely
const MAX_CURRENT_DATUMS_PER_SERIES = 50_000;

const compareDatum = (a: Datum, b: Datum) => a.x - b.x;

export class TimestampDatasetsBuilderImpl {
  #seriesByKey = new Map<SeriesConfigKey, Series>();

  public getViewportDatasets(viewport: Immutable<Viewport>): Dataset[] {
    const datasets: Dataset[] = [];
    const numSeries = this.#seriesByKey.size;
    for (const series of this.#seriesByKey.values()) {
      if (!series.config.enabled) {
        continue;
      }
      const { color, contrastColor, showLine } = series.config;
      const dataset: Dataset = {
        borderColor: color,
        showLine,
        fill: false,
        borderWidth: series.config.lineSize,
        pointRadius: series.config.lineSize * 1.2,
        pointHoverRadius: 3,
        pointBackgroundColor: showLine ? contrastColor : color,
        pointBorderColor: "transparent",
        data: [],
      };

      datasets[series.config.configIndex] = dataset;

      // Copy so we can set the .index property for downsampling
      // If downsampling algos change to not need the .index then we can get rid of some copies
      const allData = series.full.slice();

      allData.push(...series.current);

      let startIdx = 0;
      let endIdx = allData.length;

      const xBounds: Bounds1D = { min: Number.MAX_VALUE, max: Number.MIN_VALUE };
      const yBounds: Bounds1D = { min: Number.MAX_VALUE, max: Number.MIN_VALUE };

      // Keep previous original values for computing derivative
      let prevX = NaN;
      let prevY = NaN;

      const derivative = series.config.parsed.modifier === "derivative";

      // Trim the dataset down to the view area. include one point on either side so it appears
      // to extend out of the view area.
      for (let i = 0; i < allData.length; ++i) {
        const item = allData[i]!;
        item.index = i;

        if (derivative) {
          if (i === 0) {
            // When we compute the derivative we will remove the first datum since we cannot compute its derivative
            startIdx = 1;
            prevX = item.x;
            prevY = item.y;
            continue;
          }
          // calculate derivative and replace existing datum
          const dx = item.x - prevX;
          const newY = dx === 0 ? NaN : (item.y - prevY) / dx;
          allData[i] = {
            ...item,
            y: newY,
            value: newY,
          };
          prevX = item.x;
          prevY = item.y;
        }

        if (viewport.bounds.x?.min != undefined && item.x < viewport.bounds.x.min) {
          startIdx = i;
          continue;
        }

        if (!isNaN(item.x)) {
          extendBounds1D(xBounds, item.x);
        }

        if (!isNaN(item.y)) {
          extendBounds1D(yBounds, item.y);
        }

        if (viewport.bounds.x?.max != undefined && item.x > viewport.bounds.x.max) {
          endIdx = i;
          break;
        }
      }

      const items = allData.slice(startIdx, endIdx + 1);

      const downsampleViewport = {
        width: viewport.size.width,
        height: viewport.size.height,
        bounds: {
          x: {
            min: viewport.bounds.x?.min ?? xBounds.min,
            max: viewport.bounds.x?.max ?? xBounds.max,
          },
          y: {
            min: viewport.bounds.y?.min ?? yBounds.min,
            max: viewport.bounds.y?.max ?? yBounds.max,
          },
        },
      };

      const maxPoints = MAX_POINTS / numSeries;

      // We already have fewer items than the viewport width so there's no need to downsample
      //
      // Points could still "overlap" but we don't care because we are under our threshold for
      // the number of points we want to return for a dataset.
      //
      // This avoids situations where downsampling might resolve datums to the same pixel at
      // different zoom levels (due to pixel rounding for datums) as we zoom in and cause us to
      // remove data points and hide dots. This creates a counter-intuitive UX where dots can
      // dissapear when zooming in.
      const min = Math.min(downsampleViewport.width, maxPoints);

      const downsampledIndices =
        items.length < min
          ? items.map((item) => item.index)
          : dataset.showLine === true
            ? downsampleTimeseries(items, downsampleViewport, maxPoints)
            : downsampleScatter(items, downsampleViewport);

      // When a series is downsampled the points are disabled as a visual indicator that
      // data is downsampled.
      //
      // If show line is false then we must show points otherwise nothing will be displayed
      if (downsampledIndices.length < items.length && dataset.showLine === true) {
        dataset.pointRadius = 0;
      }

      // We only need to add the NaN entry if using lines and there is both full and current data
      // to create a discontinuity after the full data.
      let shouldAddNan = dataset.showLine === true && series.full.length > 0;

      for (const index of downsampledIndices) {
        const item = allData[index];
        if (!item) {
          continue;
        }

        // Add a NaN entry to create a discontinuity between the full data and the current data and
        // avoid the "long interpolated line" during preloading if the current playback head is
        // later in the data
        if (shouldAddNan && index >= series.full.length) {
          shouldAddNan = false;
          dataset.data.push({
            x: NaN,
            y: NaN,
            value: NaN,
          });
        }

        dataset.data.push({
          x: item.x,
          y: item.y,
          value: item.value,
        });
      }
    }

    return datasets;
  }

  public getCsvData(): CsvDataset[] {
    const datasets: CsvDataset[] = [];
    for (const series of this.#seriesByKey.values()) {
      if (!series.config.enabled) {
        continue;
      }

      const allData = series.full.slice();
      if (series.current.length > 0) {
        allData.push(...series.current);
      }

      datasets.push({
        label: series.config.messagePath,
        data: allData,
      });
    }

    return datasets;
  }

  public applyActions(actions: Immutable<UpdateDataAction[]>): void {
    for (const action of actions) {
      this.applyAction(action);
    }
  }

  public applyAction(action: Immutable<UpdateDataAction>): void {
    switch (action.type) {
      case "reset-current": {
        const series = this.#seriesByKey.get(action.series);
        if (!series) {
          return;
        }
        // when we reset current we make a new array since we'll assume the full will load
        // we won't need to keep getting current data
        series.current = [];
        break;
      }
      case "reset-full": {
        const series = this.#seriesByKey.get(action.series);
        if (!series) {
          return;
        }
        // splice to keep underlying memory since we typically expect to fill it again
        series.full.splice(0, series.full.length);
        break;
      }
      case "append-current": {
        const series = this.#seriesByKey.get(action.series);
        if (!series) {
          return;
        }

        // trim current data to remove values present in the full data
        const lastX = series.full[series.full.length - 1]?.x;

        // Limit the total current datums for any series so they do not grow indefinitely
        const cullSize = Math.max(
          0,
          series.current.length + action.items.length - MAX_CURRENT_DATUMS_PER_SERIES,
        );

        // cull more than max so we don't have to cull again immediately
        if (cullSize > 0) {
          series.current.splice(0, cullSize + MAX_CURRENT_DATUMS_PER_SERIES * 0.25);
        }

        const sorted =
          series.config.timestampMethod === "headerStamp"
            ? action.items.slice().sort(compareDatum)
            : action.items;

        for (const item of sorted) {
          if (lastX != undefined && item.x <= lastX) {
            continue;
          }

          const idx = series.current.length;
          series.current.push({
            index: idx,
            x: item.x,
            y: item.y,
            receiveTime: item.receiveTime,
            headerStamp: item.headerStamp,
            value: item.value,
          });
        }

        if (series.config.timestampMethod === "headerStamp") {
          series.current.sort(compareDatum);
        }
        break;
      }
      case "append-full": {
        const series = this.#seriesByKey.get(action.series);
        if (!series) {
          return;
        }

        for (const item of action.items) {
          const idx = series.full.length;
          series.full.push({
            index: idx,
            x: item.x,
            y: item.y,
            receiveTime: item.receiveTime,
            headerStamp: item.headerStamp,
            value: item.value,
          });
        }

        if (series.config.timestampMethod === "headerStamp") {
          series.full.sort(compareDatum);
        }

        // trim current data to remove values present in the full data
        const lastX = series.full[series.full.length - 1]?.x;
        if (lastX != undefined) {
          let idx = 0;
          for (const item of series.current) {
            if (item.x > lastX) {
              break;
            }
            idx += 1;
          }

          if (idx > 0) {
            series.current.splice(0, idx);
          }
        }
        break;
      }
      case "update-series-config":
        this.#updateSeriesConfigAction(action.seriesItems);
        break;
    }
  }

  #updateSeriesConfigAction(series: Immutable<SeriesItem[]>): void {
    // Make a new map so we drop series which are no longer present
    const newSeries = new Map();

    for (const config of series) {
      let existingSeries = this.#seriesByKey.get(config.key);
      if (!existingSeries) {
        existingSeries = {
          config,
          current: [],
          full: [],
        };
      }
      newSeries.set(config.key, existingSeries);
      existingSeries.config = config;
    }
    this.#seriesByKey = newSeries;
  }
}
