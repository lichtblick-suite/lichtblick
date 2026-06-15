// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";
import { compare } from "@lichtblick/rostime";
import {
  IterableSourceConstructor,
  MultiSource,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/types";
import {
  accumulateMap,
  mergeMetadata,
  mergeTopicStats,
  setEndTime,
  setStartTime,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/utils/mergeInitialization";
import { mergeSequentialIterators } from "@lichtblick/suite-base/players/IterablePlayer/shared/utils/mergeSequentialIterators";
import {
  filterSourcesForBackfill,
  filterSourcesByTimeRange,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/utils/sourceTimeOverlap";
import {
  validateAndAddNewTopics,
  validateAndAddNewDatatypes,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/utils/validateInitialization";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

import {
  IIterableSource,
  IteratorResult,
  Initialization,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
  ISerializedIterableSource,
} from "../IIterableSource";

const log = Logger.getLogger(__filename);

// Default total cache budget for remote sources (500 MiB — same as single-file default).
const DEFAULT_CACHE_TOTAL_BYTES = 1024 * 1024 * 500; // 500 MiB

// Minimum cache allocated per remote source to prevent crashes when reading MCAP metadata.
// The MCAP summary section (chunk indexes, schema records, etc.) can be several MiB in size.
// Without a floor, a linear split across 300+ files produces cache slices smaller than a
// single metadata read, causing CachedFilelike to throw "Requested more data than cache size".
const MIN_CACHE_PER_SOURCE_BYTES = 1024 * 1024 * 10; // 10 MiB

export class MultiIterableSource<T extends ISerializedIterableSource, P>
  implements ISerializedIterableSource
{
  public readonly sourceType = "serialized";
  private SourceConstructor: IterableSourceConstructor<T, P>;
  private dataSource: MultiSource;
  private sourceImpl: IIterableSource<Uint8Array>[] = [];

  public constructor(dataSource: MultiSource, SourceConstructor: IterableSourceConstructor<T, P>) {
    this.dataSource = dataSource;
    this.SourceConstructor = SourceConstructor;
  }

  private async loadMultipleSources(): Promise<Initialization[]> {
    const { type } = this.dataSource;

    let sources: IIterableSource<Uint8Array>[];
    if (type === "files") {
      sources = this.dataSource.files.map(
        (file) => new this.SourceConstructor({ type: "file", file } as P),
      );
    } else {
      // Distribute total cache budget across remote sources with a minimum floor per source.
      // A pure linear split (totalCache / n) can produce a per-source budget smaller than a
      // single MCAP metadata read when n > ~300, causing a crash in CachedFilelike.
      const totalCache: number = this.dataSource.totalCacheSizeInBytes ?? DEFAULT_CACHE_TOTAL_BYTES;
      const minPerSource: number =
        this.dataSource.minCachePerSourceBytes ?? MIN_CACHE_PER_SOURCE_BYTES;
      const numSources: number = this.dataSource.urls.length;
      const perSourceCache: number = Math.max(minPerSource, Math.floor(totalCache / numSources));

      if (perSourceCache * numSources > totalCache) {
        log.warn(
          `Cache budget (${totalCache} bytes) is less than minimum per-source cache ` +
            `(${minPerSource} bytes) × ${numSources} sources. ` +
            `Each source will use ${perSourceCache} bytes; total may exceed budget.`,
        );
      }

      sources = this.dataSource.urls.map(
        (url) =>
          new this.SourceConstructor({
            type: "url",
            url,
            cacheSizeInBytes: perSourceCache,
          } as P),
      );
    }

    this.sourceImpl.push(...sources);

    const initializations: Initialization[] = await Promise.all(
      sources.map(async (source) => await source.initialize()),
    );

    return initializations;
  }

  public async initialize(): Promise<Initialization> {
    const initializations: Initialization[] = await this.loadMultipleSources();

    const resultInit: Initialization = this.mergeInitializations(initializations);

    this.sourceImpl.sort((a, b) => {
      const aStart = a.getStart?.() ?? { sec: 0, nsec: 0 };
      const bStart = b.getStart?.() ?? { sec: 0, nsec: 0 };
      return compare(aStart, bStart);
    });

    return resultInit;
  }

  public async *messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    // Filter sources to only those overlapping the requested time range.
    // For full-range playback this still includes all sources, but for block loading
    // with specific start/end it avoids triggering HTTP requests to irrelevant files.
    const relevantSources = filterSourcesByTimeRange(this.sourceImpl, opt.start, opt.end);

    // Use lazy sequential merge: iterators for later sources are only started
    // when the current playback time reaches their start time, avoiding
    // concurrent HTTP byte-range requests to all remote MCAP files at once.
    yield* mergeSequentialIterators(relevantSources, opt);
  }
  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    // Only query sources that could contain messages at or before the backfill time.
    // This avoids triggering HTTP requests to MCAP files that start after the requested time.
    const relevantSources = filterSourcesForBackfill(this.sourceImpl, args.time);

    const backfillMessages = await Promise.all(
      relevantSources.map(async (source) => await source.getBackfillMessages(args)),
    );

    return backfillMessages.flat();
  }

  private mergeInitializations(initializations: Initialization[]): Initialization {
    const resultInit: Initialization = {
      start: { sec: Number.MAX_SAFE_INTEGER, nsec: Number.MAX_SAFE_INTEGER },
      end: { sec: Number.MIN_SAFE_INTEGER, nsec: Number.MIN_SAFE_INTEGER },
      datatypes: new Map(),
      metadata: [],
      alerts: [],
      profile: "",
      publishersByTopic: new Map(),
      topics: [],
      topicStats: new Map(),
    };

    for (const init of initializations) {
      resultInit.start = setStartTime(resultInit.start, init.start);
      resultInit.end = setEndTime(resultInit.end, init.end);

      resultInit.profile = init.profile ?? resultInit.profile;
      resultInit.publishersByTopic = accumulateMap(
        resultInit.publishersByTopic,
        init.publishersByTopic,
      );
      resultInit.topicStats = mergeTopicStats(resultInit.topicStats, init.topicStats);
      resultInit.metadata = mergeMetadata(resultInit.metadata, init.metadata);
      resultInit.alerts.push(...init.alerts);
      // These methos validate and add to avoid lopp through all topics and datatypes once again
      validateAndAddNewDatatypes(resultInit, init);
      validateAndAddNewTopics(resultInit, init);
    }
    return resultInit;
  }
}
