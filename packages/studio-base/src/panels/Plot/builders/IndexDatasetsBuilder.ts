// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChartDataset } from "chart.js";

import { filterMap } from "@foxglove/den/collection";
import { MessagePath } from "@foxglove/message-path";
import { Immutable, Time, MessageEvent } from "@foxglove/studio";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { Bounds1D } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { PlayerState } from "@foxglove/studio-base/players/types";

import {
  CsvDataset,
  GetViewportDatasetsResult,
  IDatasetsBuilder,
  SeriesConfigKey,
  SeriesItem,
} from "./IDatasetsBuilder";
import { Dataset } from "../ChartRenderer";
import { getChartValue, isChartValue, Datum } from "../datum";
import { mathFunctions } from "../mathFunctions";

type DatumWithReceiveTime = Datum & {
  receiveTime: Time;
};

type IndexDatasetsSeries = {
  configIndex: number;
  enabled: boolean;
  messagePath: string;
  parsed: Immutable<MessagePath>;
  dataset: ChartDataset<"scatter", DatumWithReceiveTime[]>;
};

const emptyPaths = new Set<string>();

export class IndexDatasetsBuilder implements IDatasetsBuilder {
  #seriesByKey = new Map<SeriesConfigKey, IndexDatasetsSeries>();

  #range?: Bounds1D;

  public handlePlayerState(state: Immutable<PlayerState>): Bounds1D | undefined {
    const activeData = state.activeData;
    if (!activeData) {
      return;
    }

    const msgEvents = activeData.messages;
    if (msgEvents.length === 0) {
      // When there are no new messages we keep returning the same bounds as before since our
      // datasets have not changed.
      return this.#range;
    }

    const range: Bounds1D = { min: 0, max: 0 };
    for (const series of this.#seriesByKey.values()) {
      const mathFn = series.parsed.modifier ? mathFunctions[series.parsed.modifier] : undefined;

      const msgEvent = lastMatchingTopic(msgEvents, series.parsed.topicName);
      if (!msgEvent) {
        continue;
      }

      const items = simpleGetMessagePathDataItems(msgEvent, series.parsed);
      const pathItems = filterMap(items, (item, idx) => {
        if (!isChartValue(item)) {
          return;
        }

        const chartValue = getChartValue(item);
        const mathModifiedValue =
          mathFn && chartValue != undefined ? mathFn(chartValue) : undefined;
        return {
          x: idx,
          y: chartValue == undefined ? NaN : mathModifiedValue ?? chartValue,
          receiveTime: msgEvent.receiveTime,
          value: mathModifiedValue ?? item,
        };
      });

      series.dataset.data = pathItems;
      range.max = Math.max(range.max, series.dataset.data.length - 1);
    }

    return (this.#range = range);
  }

  public setSeries(series: Immutable<SeriesItem[]>): void {
    // Make a new map so we drop series which are no longer present
    const newSeries = new Map();

    for (const item of series) {
      let existingSeries = this.#seriesByKey.get(item.key);
      if (!existingSeries) {
        existingSeries = {
          configIndex: item.configIndex,
          enabled: item.enabled,
          messagePath: item.messagePath,
          parsed: item.parsed,
          dataset: {
            data: [],
          },
        };
      }

      existingSeries.configIndex = item.configIndex;
      existingSeries.enabled = item.enabled;
      existingSeries.dataset = {
        ...existingSeries.dataset,
        borderColor: item.color,
        showLine: item.showLine,
        fill: false,
        borderWidth: item.lineSize,
        pointRadius: item.lineSize * 1.2,
        pointHoverRadius: 3,
        pointBackgroundColor: item.showLine ? item.contrastColor : item.color,
        pointBorderColor: "transparent",
      };

      newSeries.set(item.key, existingSeries);
    }
    this.#seriesByKey = newSeries;
  }

  // We don't use the viewport because we do not do any downsampling on the assumption that
  // one message won't produce so many points that we need to downsample.
  //
  // If that assumption changes then downsampling can be revisited.
  public async getViewportDatasets(): Promise<GetViewportDatasetsResult> {
    const datasets: Dataset[] = [];
    for (const series of this.#seriesByKey.values()) {
      if (series.enabled) {
        datasets[series.configIndex] = series.dataset;
      }
    }

    return { datasetsByConfigIndex: datasets, pathsWithMismatchedDataLengths: emptyPaths };
  }

  public async getCsvData(): Promise<CsvDataset[]> {
    const datasets: CsvDataset[] = [];
    for (const series of this.#seriesByKey.values()) {
      if (!series.enabled) {
        continue;
      }

      datasets.push({
        label: series.messagePath,
        data: series.dataset.data,
      });
    }

    return datasets;
  }
}

function lastMatchingTopic(msgEvents: Immutable<MessageEvent[]>, topic: string) {
  for (let i = msgEvents.length - 1; i >= 0; --i) {
    const msgEvent = msgEvents[i]!;
    if (msgEvent.topic === topic) {
      return msgEvent;
    }
  }

  return undefined;
}
