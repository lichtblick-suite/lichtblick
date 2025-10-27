// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChartDataset } from "chart.js";

import { filterMap } from "@lichtblick/den/collection";
import { MessagePath } from "@lichtblick/message-path";
import { Immutable, Time, MessageEvent } from "@lichtblick/suite";
import { simpleGetMessagePathDataItems } from "@lichtblick/suite-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { Bounds1D } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { PlayerState } from "@lichtblick/suite-base/players/types";

import {
  CsvDataset,
  GetViewportDatasetsResult,
  HandlePlayerStateResult,
  IDatasetsBuilder,
  SeriesConfigKey,
  SeriesItem,
} from "./IDatasetsBuilder";
import { MATH_FUNCTIONS } from "../constants";
import { Dataset } from "../types";
import { getChartValue, isChartValue, Datum } from "../utils/datum";

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

  public handlePlayerState(state: Immutable<PlayerState>): HandlePlayerStateResult | undefined {
    const activeData = state.activeData;
    if (!activeData) {
      return;
    }

    const msgEvents = activeData.messages;
    if (msgEvents.length === 0) {
      // When there are no new messages we keep returning the same bounds as before since our
      // datasets have not changed.
      return {
        range: this.#range,
        datasetsChanged: false,
      };
    }

    const range: Bounds1D = { min: 0, max: 0 };
    let datasetsChanged = false;
    for (const series of this.#seriesByKey.values()) {
      const mathFn = series.parsed.modifier ? MATH_FUNCTIONS[series.parsed.modifier] : undefined;

      const msgEvent = lastMatchingTopic(msgEvents, series.parsed.topicName);
      if (!msgEvent) {
        continue;
      }

      // If there is an input message for the series, we consider the datasets changed regardless of
      // how many points might be produced.
      datasetsChanged = true;

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
          y: chartValue == undefined ? NaN : (mathModifiedValue ?? chartValue),
          receiveTime: msgEvent.receiveTime,
          value: mathModifiedValue ?? item,
        };
      });

      series.dataset.data = pathItems;
      range.max = Math.max(range.max, series.dataset.data.length - 1);
    }

    this.#range = range;
    return {
      range: this.#range,
      datasetsChanged,
    };
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
