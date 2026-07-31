// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Semaphore } from "async-mutex";

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
import { HydratedSourcePool } from "./HydratedSourcePool";

const log = Logger.getLogger(__filename);

// Default total cache budget for remote sources (500 MiB — same as single-file default).
const DEFAULT_CACHE_TOTAL_BYTES = 1024 * 1024 * 500; // 500 MiB

// Minimum cache allocated per remote source to prevent crashes when reading MCAP metadata.
// The MCAP summary section (chunk indexes, schema records, etc.) can be several MiB in size.
// Without a floor, a linear split across 300+ files produces cache slices smaller than a
// single metadata read, causing CachedFilelike to throw "Requested more data than cache size".
const MIN_CACHE_PER_SOURCE_BYTES = 1024 * 1024 * 10; // 10 MiB

// Default number of remote sources initialized concurrently. Bounds the initial request burst and the transient memory spike from concurrent MCAP summary reads.
const DEFAULT_INIT_CONCURRENCY = 4;

// Default number of heavyweight per-file readers kept resident at once for remote multi-file
// sessions. Bounds worker memory; sources beyond this are re-opened on demand.
const DEFAULT_MAX_HYDRATED_SOURCES = 8;

export class MultiIterableSource<T extends ISerializedIterableSource, P>
  implements ISerializedIterableSource
{
  public readonly sourceType = "serialized";
  private SourceConstructor: IterableSourceConstructor<T, P>;
  private dataSource: MultiSource;
  private sourceImpl: IIterableSource<Uint8Array>[] = [];
  #pool: HydratedSourcePool | undefined;

  public constructor(dataSource: MultiSource, SourceConstructor: IterableSourceConstructor<T, P>) {
    this.dataSource = dataSource;
    this.SourceConstructor = SourceConstructor;
  }

  private async loadMultipleSources(): Promise<Initialization[]> {
    const { type } = this.dataSource;

    let sources: IIterableSource<Uint8Array>[];
    if (type === "files") {
      const maxHydrated = this.dataSource.maxHydratedSources ?? DEFAULT_MAX_HYDRATED_SOURCES;
      this.#pool = new HydratedSourcePool(maxHydrated);
      sources = this.dataSource.files.map(
        (file) => new this.SourceConstructor({ type: "file", file, pool: this.#pool } as P),
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

      // Default to lazy loading for multi-file remote sessions: with many small MCAPs the
      // speculative whole-file read-ahead would download every file up-front. A single-file
      // session keeps the legacy read-ahead behaviour. Callers may override explicitly.
      const readAheadEnabled: boolean =
        this.dataSource.readAheadEnabled ?? this.dataSource.urls.length === 1;

      const maxHydrated = this.dataSource.maxHydratedSources ?? DEFAULT_MAX_HYDRATED_SOURCES;
      this.#pool = new HydratedSourcePool(maxHydrated);

      sources = this.dataSource.urls.map(
        (url) =>
          new this.SourceConstructor({
            type: "url",
            url,
            cacheSizeInBytes: perSourceCache,
            readAheadEnabled,
            pool: this.#pool,
          } as P),
      );
    }

    this.sourceImpl.push(...sources);

    // Both local blobs and remote urls are bounded: parsing many MCAP channel schemas concurrently
    // produces a large transient memory spike (a dominant contributor to worker OOM in big
    // multi-file sessions).
    const concurrency = this.dataSource.initConcurrency ?? DEFAULT_INIT_CONCURRENCY;

    return await this.initializeSources(sources, concurrency);
  }

  private async initializeSources(
    sources: IIterableSource<Uint8Array>[],
    concurrency: number,
  ): Promise<Initialization[]> {
    const semaphore = new Semaphore(Math.max(1, concurrency));
    // Promise.all preserves input order regardless of settle order, so the returned
    // initializations stay aligned with `sources`.
    return await Promise.all(
      sources.map(
        async (source) => await semaphore.runExclusive(async () => await source.initialize()),
      ),
    );
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
    // Only consider sources that could contain messages at or before the backfill time.
    // This avoids triggering HTTP requests to MCAP files that start after the requested time.
    const relevantSources = filterSourcesForBackfill(this.sourceImpl, args.time);

    // Query sources nearest to the backfill time first and stop as soon as every requested topic
    // has a value. `sourceImpl` (and therefore `relevantSources`) is sorted ascending by start
    // time, so we iterate in reverse to begin with the source covering the seek target.
    //
    // Without this short-circuit, every preceding source would independently read its last chunk
    // for the requested topics — a large redundant download. For example, a forward seek across
    // many small remote MCAPs fetched ~one chunk per preceding file even though only the
    // nearest source(s) hold the winning "latest message before time" values.
    const backfillMessages: MessageEvent<Uint8Array>[] = [];
    const missingTopics = new Map(args.topics);

    for (let index = relevantSources.length - 1; index >= 0; index--) {
      if (missingTopics.size === 0) {
        break;
      }

      const source = relevantSources[index]!;
      // Pass a snapshot of the still-missing topics so later mutation of `missingTopics` cannot
      // alias the map handed to the source.
      const topicsForSource = new Map(missingTopics);
      const messages = await source.getBackfillMessages({ ...args, topics: topicsForSource });
      if (messages.length === 0) {
        continue;
      }

      backfillMessages.push(...messages);
      for (const message of messages) {
        missingTopics.delete(message.topic);
      }
    }

    return backfillMessages;
  }

  public async terminate(): Promise<void> {
    await Promise.all(this.sourceImpl.map(async (source) => await source.terminate?.()));
    await this.#pool?.terminate();
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
