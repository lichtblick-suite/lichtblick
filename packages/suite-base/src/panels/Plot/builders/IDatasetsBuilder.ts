// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Opaque } from "ts-essentials";

import { MessagePath } from "@lichtblick/message-path";
import type { Immutable, Time, MessageEvent } from "@lichtblick/suite";
import type { Bounds1D } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import type { MessageBlock, PlayerState } from "@lichtblick/suite-base/players/types";
import { TimestampMethod } from "@lichtblick/suite-base/util/time";

import type { Dataset } from "../types";
import { OriginalValue } from "../utils/datum";

type CsvDatum = {
  x: number;
  y: number;
  receiveTime: Time;
  headerStamp?: Time;
  value: OriginalValue;
};

type Size = { width: number; height: number };

/**
 * Identifier used to determine whether previous data can be reused when the config changes.
 * Compare with deep equality.
 */
export type SeriesConfigKey = Opaque<string, "series-config-key">;

export type SeriesItem = {
  key: SeriesConfigKey;
  /** The original index of this series in config.paths */
  configIndex: number;
  messagePath: string;
  parsed: MessagePath;
  color: string;
  /** Used for points when lines are also shown to provide extra contrast */
  contrastColor: string;
  timestampMethod: TimestampMethod;
  showLine: boolean;
  lineSize: number;
  enabled: boolean;
};

export type Viewport = {
  /**
   * The data bounds of the viewport. The bounds hint which data will be visible to the user. When
   * undefined, assumes that all data is visible in the viewport.
   */
  bounds: {
    x?: Partial<Bounds1D>;
    y?: Partial<Bounds1D>;
  };
  /** The pixel size of the viewport */
  size: Size;
};

export type CsvDataset = {
  label: string;
  data: CsvDatum[];
};

export type GetViewportDatasetsResult = {
  /**
   * Indices correspond to original indices of series in `config.paths`. Array may be sparse if
   * series are invalid (parsing fails) or if they are disabled.
   */
  datasetsByConfigIndex: readonly (Dataset | undefined)[];
  pathsWithMismatchedDataLengths: ReadonlySet<string>;
};

export type HandlePlayerStateResult = {
  /**
   * The x-axis range of the dataset if it is known.
   *
   * Setting the range to undefined indicates the builder does not know the range or does not want
   * to impose a specific range.
   */
  range?: Immutable<Bounds1D>;
  /** True if the datasets were changed (i.e. the builder extracted new data from the state) */
  datasetsChanged: boolean;
};

/**
 * IDatasetBuilder defines methods for updating the building a dataset.
 *
 * Dataset updates (via new player state, and config) are synchronous and the callers do not expect
 * to wait on any promise. While getting the viewport datasets and csv data are async to allow them
 * to happen on a worker.
 */
interface IDatasetsBuilder {
  handlePlayerState(state: Immutable<PlayerState>): HandlePlayerStateResult | undefined;

  /**
   * The builder can provide an implementation of this method to incrementally accumulate full
   * message history delivered via `subscribeMessageRange`. Each call provides a batch of messages
   * for a single topic, together with a `startTime` used to compute relative x-axis offsets.
   *
   * When `options.isReset` is true the builder should discard any previously accumulated data for
   * that topic before processing the new batch, signalling the start of a fresh range subscription
   * (e.g. after a seek). Subsequent calls with `isReset: false` append to the existing data.
   */
  handleMessageRange?(
    messages: Immutable<MessageEvent[]>,
    options: { isReset: boolean },
    startTime?: Immutable<Time>,
  ): void;

  setSeries(series: Immutable<SeriesItem[]>): void;

  /**
   * Optional: return the x-axis topic name if this builder uses a separate x-axis topic
   * (e.g. custom x-axis mode). The coordinator will subscribe to this topic in addition to
   * the y-series topics so that handleMessageRange receives batches for it.
   */
  getXTopic?(): string | undefined;

  getViewportDatasets(viewport: Immutable<Viewport>): Promise<GetViewportDatasetsResult>;

  getCsvData(): Promise<CsvDataset[]>;
}

export type { IDatasetsBuilder };
