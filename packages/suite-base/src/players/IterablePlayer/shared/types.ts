// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import {
  IIterableSource,
  Initialization,
  IteratorResult,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

export type MultiSource =
  | { type: "files"; files: Blob[]; initConcurrency?: number; maxResidentSources?: number }
  | {
      type: "urls";
      urls: string[];
      totalCacheSizeInBytes?: number;
      minCachePerSourceBytes?: number;
      // When false (default for multi-file), each remote source downloads lazily without
      // speculative read-ahead. When true, legacy whole-file read-ahead is used.
      readAheadEnabled?: boolean;
      // Max number of sources whose initialize() runs concurrently. Bounds the memory/CPU
      // spike from reading many MCAP summary sections at once.
      initConcurrency?: number;
      // Max number of sources kept initialized (parsed reader resident) at once. Others are
      // terminated and re-created lazily to bound worker memory.
      maxResidentSources?: number;
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
