// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import {
  IIterableSource,
  Initialization,
  IteratorResult,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

// Contract a caller supplies to HydratedSourcePool for a hydrated (heavyweight) value.
export type SourceHydrator<T> = {
  // Create the heavyweight value (open readable, build reader, parse channels, ...).
  open: () => Promise<T>;
  // Release the heavyweight value (close readable/connection, drop references).
  close: (value: T) => Promise<void>;
  // Optional estimated resident memory (bytes) of the hydrated value, used by the byte budget.
  // When omitted, every entry weighs 1 so the pool behaves as a pure count cap.
  weigh?: (value: T) => number;
};

export type HydratedSourcePoolOptions = {
  // Primary limiter: evict LRU unpinned entries while total estimated bytes exceeds this.
  maxBytes?: number;
  // Safety cap on resident entry count (bounds open connections/readers regardless of weight).
  maxCount?: number;
  // Never evict below this many entries (default 1), even when over the byte/count budget.
  minResident?: number;
};

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
      // When false, each remote source downloads only exact requested ranges with no speculative
      // read-ahead. When omitted, MultiIterableSource now defaults to read-ahead enabled and uses
      // readAheadBufferBytes to keep multi-file sessions safely bounded.
      readAheadEnabled?: boolean;
      // Bounds the speculative read-ahead extension (bytes) used when readAheadEnabled is true.
      // When omitted, MultiIterableSource derives a safe multi-file value from the per-source
      // cache budget, while single-file sessions keep the legacy 50 MiB default from
      // getNewConnection.ts.
      readAheadBufferBytes?: number;
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
