// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { toSec, subtract as subtractTime } from "@foxglove/rostime";
import { Immutable, MessageEvent, Time } from "@foxglove/studio";
import { RosPath } from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { Bounds1D } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { MessageBlock, PlayerState } from "@foxglove/studio-base/players/types";
import { TimestampMethod, getTimestampForMessage } from "@foxglove/studio-base/util/time";

import { BlockTopicCursor } from "./BlockTopicCursor";
import {
  CsvDataset,
  GetViewportDatasetsResult,
  IDatasetsBuilder,
  SeriesItem,
  Viewport,
} from "./IDatasetsBuilder";
import type {
  DataItem,
  TimestampDatasetsBuilderImpl,
  UpdateDataAction,
} from "./TimestampDatasetsBuilderImpl";
import { getChartValue, isChartValue } from "../datum";
import { MathFunction, mathFunctions } from "../mathFunctions";

// If the datasets builder is garbage collected we also need to cleanup the worker
// This registry ensures the worker is cleaned up when the builder is garbage collected
const registry = new FinalizationRegistry<Worker>((worker) => {
  worker.terminate();
});

const emptyPaths = new Set<string>();

type TimestampSeriesItem = {
  config: Immutable<SeriesItem>;
  blockCursor: BlockTopicCursor;
};

/**
 * TimestampDatasetsBuilder builds timeseries datasets.
 *
 * It supports full (preload) data and current frame data. The series datums are extracted from
 * input player states and sent to the worker. The worker accumulates the data and provides
 * downsampled data.
 */
export class TimestampDatasetsBuilder implements IDatasetsBuilder {
  #datasetsBuilderWorker: Worker;
  #datasetsBuilderRemote: Comlink.Remote<Comlink.RemoteObject<TimestampDatasetsBuilderImpl>>;

  #pendingDataDispatch: Immutable<UpdateDataAction>[] = [];

  #lastSeekTime = 0;

  #series: Immutable<TimestampSeriesItem[]> = [];

  public constructor() {
    this.#datasetsBuilderWorker = new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL("./TimestampDatasetsBuilderImpl.worker", import.meta.url),
    );
    this.#datasetsBuilderRemote = Comlink.wrap(this.#datasetsBuilderWorker);

    registry.register(this, this.#datasetsBuilderWorker);
  }

  public handlePlayerState(state: Immutable<PlayerState>): Bounds1D | undefined {
    const activeData = state.activeData;
    if (!activeData) {
      return;
    }

    const didSeek = activeData.lastSeekTime !== this.#lastSeekTime;
    this.#lastSeekTime = activeData.lastSeekTime;

    const msgEvents = activeData.messages;
    if (msgEvents.length > 0) {
      for (const series of this.#series) {
        const mathFn = series.config.parsed.modifier
          ? mathFunctions[series.config.parsed.modifier]
          : undefined;

        if (didSeek) {
          this.#pendingDataDispatch.push({
            type: "reset-current",
            series: series.config.key,
          });
        }

        const pathItems = readMessagePathItems(
          msgEvents,
          series.config.parsed,
          series.config.timestampMethod,
          activeData.startTime,
          mathFn,
        );

        this.#pendingDataDispatch.push({
          type: "append-current",
          series: series.config.key,
          items: pathItems,
        });
      }
    }

    return { min: 0, max: toSec(subtractTime(activeData.endTime, activeData.startTime)) };
  }

  public async handleBlocks(
    startTime: Immutable<Time>,
    blocks: Immutable<(MessageBlock | undefined)[]>,
    progress: () => Promise<boolean>,
  ): Promise<void> {
    // identify if series need resetting because
    for (const series of this.#series) {
      if (series.blockCursor.nextWillReset(blocks)) {
        this.#pendingDataDispatch.push({
          type: "reset-full",
          series: series.config.key,
        });
      }
    }

    const seriesArr = this.#series;

    // We loop through the series and only process one next block and keep doing this until
    // there are no more updates. This processes the series "in parallel" so that all of them appear
    // to be loading blocks at the same time.
    let done = 0;
    do {
      done = 0;

      for (const series of seriesArr) {
        const mathFn = series.config.parsed.modifier
          ? mathFunctions[series.config.parsed.modifier]
          : undefined;

        const messageEvents = series.blockCursor.next(blocks);
        if (!messageEvents) {
          done += 1;
          continue;
        }

        const pathItems = readMessagePathItems(
          messageEvents,
          series.config.parsed,
          series.config.timestampMethod,
          startTime,
          mathFn,
        );

        if (pathItems.length === 0) {
          continue;
        }

        this.#pendingDataDispatch.push({
          type: "append-full",
          series: series.config.key,
          items: pathItems,
        });

        const abort = await progress();
        if (abort) {
          return;
        }
      }
    } while (done < seriesArr.length);
  }

  public setSeries(series: Immutable<SeriesItem[]>): void {
    this.#series = series.map((item) => {
      const existing = this.#series.find((existingItem) => existingItem.config.key === item.key);
      return {
        config: item,
        blockCursor: existing?.blockCursor ?? new BlockTopicCursor(item.parsed.topicName),
      };
    });

    void this.#datasetsBuilderRemote.setSeries(series);
  }

  public async getViewportDatasets(
    viewport: Immutable<Viewport>,
  ): Promise<GetViewportDatasetsResult> {
    const dispatch = this.#pendingDataDispatch;
    if (dispatch.length > 0) {
      this.#pendingDataDispatch = [];
      await this.#datasetsBuilderRemote.applyActions(dispatch);
    }

    const datasets = await this.#datasetsBuilderRemote.getViewportDatasets(viewport);
    return { datasetsByConfigIndex: datasets, pathsWithMismatchedDataLengths: emptyPaths };
  }

  public async getCsvData(): Promise<CsvDataset[]> {
    return await this.#datasetsBuilderRemote.getCsvData();
  }
}

function readMessagePathItems(
  events: Immutable<MessageEvent[]>,
  path: Immutable<RosPath>,
  timestampMethod: TimestampMethod,
  startTime: Immutable<Time>,
  mathFunction?: MathFunction,
): DataItem[] {
  const out = [];
  for (const event of events) {
    if (event.topic !== path.topicName) {
      continue;
    }

    const items = simpleGetMessagePathDataItems(event, path);
    for (const item of items) {
      if (!isChartValue(item)) {
        continue;
      }
      const chartValue = getChartValue(item);
      if (chartValue == undefined) {
        continue;
      }

      const headerStamp = getTimestampForMessage(event.message);
      const timestamp = timestampMethod === "receiveTime" ? event.receiveTime : headerStamp;
      if (!timestamp) {
        continue;
      }

      const xValue = toSec(subtractTime(timestamp, startTime));
      const mathModified = mathFunction ? mathFunction(chartValue) : chartValue;
      out.push({
        x: xValue,
        y: mathModified,
        receiveTime: event.receiveTime,
        headerStamp,
        value: mathFunction ? mathModified : item,
      });
    }
  }

  return out;
}
