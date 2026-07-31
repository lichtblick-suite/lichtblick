// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import {
  IIterableSource,
  Initialization,
  IteratorResult,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

export type MultiSource =
  | {
      type: "files";
      files: Blob[];
      // Primary byte budget for resident heavyweight readers (worker memory). Overrides the
      // internal default when set. `maxHydratedSources` remains a count-cap safety on top of this.
      maxHydratedBytes?: number;
      // Maximum number of heavyweight per-file readers kept resident at once. Bounds worker memory
      // for large multi-file sessions; sources beyond this are re-opened on demand.
      maxHydratedSources?: number;
      // Maximum number of sources initialized concurrently. Bounds the transient memory spike from
      // concurrently parsing many MCAP channel schemas.
      initConcurrency?: number;
    }
  | {
      type: "urls";
      urls: string[];
      totalCacheSizeInBytes?: number;
      minCachePerSourceBytes?: number;
      // When false (default for multi-file), each remote source downloads lazily without
      // speculative read-ahead. When true, legacy whole-file read-ahead is used.
      readAheadEnabled?: boolean;
      // Maximum number of remote sources initialized concurrently. Bounds the initial request
      // burst and the transient memory spike from concurrent MCAP summary reads. Defaults to a
      // small value for multi-file remote sessions.
      initConcurrency?: number;
      // Primary byte budget for resident heavyweight readers (worker memory). Overrides the
      // internal default when set. `maxHydratedSources` remains a count-cap safety on top of this.
      maxHydratedBytes?: number;
      // Maximum number of heavyweight per-file readers kept resident at once. Bounds worker memory
      // for large multi-file remote sessions; sources beyond this are re-opened on demand.
      maxHydratedSources?: number;
    };

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
