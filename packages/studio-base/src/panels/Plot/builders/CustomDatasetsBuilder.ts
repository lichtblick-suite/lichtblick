// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { ComlinkWrap } from "@foxglove/den/worker";
import { MessagePath } from "@foxglove/message-path";
import { Immutable, MessageEvent } from "@foxglove/studio";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import { Bounds1D } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { PlayerState } from "@foxglove/studio-base/players/types";
import { extendBounds1D, unionBounds1D } from "@foxglove/studio-base/types/Bounds";

import { BlockTopicCursor } from "./BlockTopicCursor";
import {
  CustomDatasetsBuilderImpl,
  UpdateDataAction,
  ValueItem,
} from "./CustomDatasetsBuilderImpl";
import {
  CsvDataset,
  GetViewportDatasetsResult,
  IDatasetsBuilder,
  SeriesItem,
  Viewport,
} from "./IDatasetsBuilder";
import { getChartValue, isChartValue } from "../datum";
import { MathFunction, mathFunctions } from "../mathFunctions";

type CustomDatasetsSeriesItem = {
  config: Immutable<SeriesItem>;
  blockCursor: BlockTopicCursor;
};

// If the datasets builder is garbage collected we also need to cleanup the worker
// This registry ensures the worker is cleaned up when the builder is garbage collected
const registry = new FinalizationRegistry<() => void>((dispose) => {
  dispose();
});

export class CustomDatasetsBuilder implements IDatasetsBuilder {
  #xParsedPath?: Immutable<MessagePath>;
  #xValuesCursor?: BlockTopicCursor;

  #datasetsBuilderRemote: Comlink.Remote<Comlink.RemoteObject<CustomDatasetsBuilderImpl>>;

  #pendingDataDispatch: Immutable<UpdateDataAction>[] = [];

  #lastSeekTime = 0;

  #series: Immutable<CustomDatasetsSeriesItem[]> = [];

  #xCurrentBounds?: Bounds1D;
  #xFullBounds?: Bounds1D;

  public constructor() {
    const worker = new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL("./CustomDatasetsBuilderImpl.worker", import.meta.url),
    );
    const { remote, dispose } =
      ComlinkWrap<Comlink.RemoteObject<CustomDatasetsBuilderImpl>>(worker);

    this.#datasetsBuilderRemote = remote;
    registry.register(this, dispose);
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
      if (didSeek) {
        this.#pendingDataDispatch.push({
          type: "reset-current-x",
        });
        this.#xCurrentBounds = undefined;
      }

      // Read the x-axis values
      if (this.#xParsedPath) {
        const mathFn = this.#xParsedPath.modifier
          ? mathFunctions[this.#xParsedPath.modifier]
          : undefined;
        const pathItems = readMessagePathItems(msgEvents, this.#xParsedPath, mathFn);

        this.#pendingDataDispatch.push({
          type: "append-current-x",
          items: pathItems,
        });

        if (pathItems.length > 0) {
          this.#xCurrentBounds = computeBounds(this.#xCurrentBounds, pathItems);
        }
      }

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

        const pathItems = readMessagePathItems(msgEvents, series.config.parsed, mathFn);
        this.#pendingDataDispatch.push({
          type: "append-current",
          series: series.config.key,
          items: pathItems,
        });
      }
    }

    const blocks = state.progress.messageCache?.blocks;
    if (blocks) {
      if (this.#xValuesCursor && this.#xParsedPath) {
        const mathFn = this.#xParsedPath.modifier
          ? mathFunctions[this.#xParsedPath.modifier]
          : undefined;

        if (this.#xValuesCursor.nextWillReset(blocks)) {
          this.#pendingDataDispatch.push({
            type: "reset-full-x",
          });
        }

        let messageEvents = undefined;
        while ((messageEvents = this.#xValuesCursor.next(blocks)) != undefined) {
          const pathItems = readMessagePathItems(messageEvents, this.#xParsedPath, mathFn);

          this.#pendingDataDispatch.push({
            type: "append-full-x",
            items: pathItems,
          });

          if (pathItems.length > 0) {
            this.#xFullBounds = computeBounds(this.#xFullBounds, pathItems);
          }
        }
      }

      for (const series of this.#series) {
        const mathFn = series.config.parsed.modifier
          ? mathFunctions[series.config.parsed.modifier]
          : undefined;

        if (series.blockCursor.nextWillReset(blocks)) {
          this.#pendingDataDispatch.push({
            type: "reset-full",
            series: series.config.key,
          });
        }

        let messageEvents = undefined;
        while ((messageEvents = series.blockCursor.next(blocks)) != undefined) {
          const pathItems = readMessagePathItems(messageEvents, series.config.parsed, mathFn);

          this.#pendingDataDispatch.push({
            type: "append-full",
            series: series.config.key,
            items: pathItems,
          });
        }
      }
    }

    if (!this.#xCurrentBounds) {
      return this.#xFullBounds ?? { min: 0, max: 1 };
    }

    if (!this.#xFullBounds) {
      return this.#xCurrentBounds;
    }

    return unionBounds1D(this.#xCurrentBounds, this.#xFullBounds);
  }

  public setXPath(path: Immutable<MessagePath> | undefined): void {
    if (JSON.stringify(path) === JSON.stringify(this.#xParsedPath)) {
      return;
    }

    this.#xParsedPath = path;
    if (this.#xParsedPath) {
      this.#xValuesCursor = new BlockTopicCursor(this.#xParsedPath.topicName);
    } else {
      this.#xValuesCursor = undefined;
    }

    this.#pendingDataDispatch.push({
      type: "reset-current-x",
    });

    this.#pendingDataDispatch.push({
      type: "reset-full-x",
    });
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
      await this.#datasetsBuilderRemote.updateData(dispatch);
    }

    return await this.#datasetsBuilderRemote.getViewportDatasets(viewport);
  }

  public async getCsvData(): Promise<CsvDataset[]> {
    return await this.#datasetsBuilderRemote.getCsvData();
  }
}

function readMessagePathItems(
  events: Immutable<MessageEvent[]>,
  path: Immutable<MessagePath>,
  mathFunction?: MathFunction,
): ValueItem[] {
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

      const mathModified = mathFunction ? mathFunction(chartValue) : chartValue;
      out.push({
        value: mathModified,
        originalValue: mathFunction ? mathModified : item,
        receiveTime: event.receiveTime,
      });
    }
  }

  return out;
}

function accumulateBounds(acc: Bounds1D, item: Immutable<ValueItem>) {
  extendBounds1D(acc, item.value);
  return acc;
}

function computeBounds(
  currentBounds: Immutable<Bounds1D> | undefined,
  items: Immutable<ValueItem[]>,
): Bounds1D {
  const itemBounds = items.reduce(accumulateBounds, {
    min: Number.MAX_VALUE,
    max: Number.MIN_VALUE,
  });

  return unionBounds1D(
    currentBounds ?? { min: Number.MAX_VALUE, max: Number.MIN_VALUE },
    itemBounds,
  );
}
