// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Opaque } from "ts-essentials";

import { MessagePath } from "@foxglove/message-path";
import type { Immutable, Time } from "@foxglove/studio";
import type { Bounds1D } from "@foxglove/studio-base/components/TimeBasedChart/types";
import type { MessageBlock, PlayerState } from "@foxglove/studio-base/players/types";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

import type { Dataset } from "../ChartRenderer";
import { OriginalValue } from "../datum";

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

/**
 * IDatasetBuilder defines methods for updating the building a dataset.
 *
 * Dataset updates (via new player state, and config) are synchronous and the callers do not expect
 * to wait on any promise. While getting the viewport datasets and csv data are async to allow them
 * to happen on a worker.
 */
interface IDatasetsBuilder {
  handlePlayerState(state: Immutable<PlayerState>): Bounds1D | undefined;

  /**
   * The builder can provide an implementation of this method to handle block data separately from
   * current frame player state data.
   *
   * The method is provided a _progress_ callback to call when there is an opportunity to render
   * some of the processed block data to provide feedback to the caller that work has happened. The
   * progress callback returns false when further processing should stop.
   */
  handleBlocks?(
    startTime: Immutable<Time>,
    blocks: Immutable<(MessageBlock | undefined)[]>,
    progress: () => Promise<boolean>,
  ): Promise<void>;

  setSeries(series: Immutable<SeriesItem[]>): void;

  getViewportDatasets(viewport: Immutable<Viewport>): Promise<GetViewportDatasetsResult>;

  getCsvData(): Promise<CsvDataset[]>;
}

export type { IDatasetsBuilder };
