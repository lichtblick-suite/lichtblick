// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import {
  IIterableSource,
  Initialization,
  IteratorResult,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

// Shared memory/concurrency overrides for a multi-file session. All optional; internal defaults
// apply when unset.
type MultiSourceHydrationOptions = {
  // Primary byte budget for resident heavyweight readers (worker memory). Overrides the internal
  // default when set. `maxHydratedSources` remains a count-cap safety on top of this.
  maxHydratedBytes?: number;
  // Maximum number of heavyweight per-file readers kept resident at once. Bounds worker memory for
  // large multi-file sessions; sources beyond this are re-opened on demand.
  maxHydratedSources?: number;
  // Maximum number of sources initialized concurrently. Bounds the transient memory spike from
  // concurrently parsing many MCAP channel schemas (and, for remote sources, the initial request
  // burst from concurrent MCAP summary reads).
  initConcurrency?: number;
};

export type MultiSource =
  | ({
      type: "files";
      files: Blob[];
    } & MultiSourceHydrationOptions)
  | ({
      type: "urls";
      urls: string[];
      totalCacheSizeInBytes?: number;
      minCachePerSourceBytes?: number;
      // When false (default for multi-file), each remote source downloads lazily without
      // speculative read-ahead. When true, legacy whole-file read-ahead is used.
      readAheadEnabled?: boolean;
    } & MultiSourceHydrationOptions);

export type IterableSourceConstructor<T extends IIterableSource, P> = new (args: P) => T;

export type InitMetadata = Initialization["metadata"];

export type InitTopicStatsMap = Initialization["topicStats"];

export type SourceWithTime = {
  source: IIterableSource;
  startTime: Time;
  endTime: Time;
};

export type SequentialIteratorMergeOptions<T extends IteratorResult> = {
  value: T;
  iterator: AsyncIterableIterator<Readonly<IteratorResult>>;
};
