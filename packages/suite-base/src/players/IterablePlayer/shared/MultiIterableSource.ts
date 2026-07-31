// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";
import { compare, Time } from "@lichtblick/rostime";
import { Immutable } from "@lichtblick/suite";
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
import { RequestQueue } from "@lichtblick/suite-base/util/RequestQueue";

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

// Default number of sources initialized concurrently. Reading many MCAP summary sections at
// once (each several MiB) can spike memory enough to crash the renderer; this bounds the peak.
const DEFAULT_INIT_CONCURRENCY = 6;

// Default number of sources kept initialized (parsed reader resident) at once. Each MCAP reader
// retains its full chunk index; with many files these stack up and OOM the worker. Others are
// terminated and lazily re-created when playback reaches them.
const DEFAULT_MAX_RESIDENT_SOURCES = 4;

// Lifecycle state for one sub-source. Only up to `#maxResidentSources` keep a live `instance`;
// the rest are terminated and re-created from `args` on demand. Cached `start`/`end` let the
// merge/sort logic keep working while a source is terminated.
type SourceRecord<P> = {
  args: P;
  start?: Time;
  end?: Time;
  instance?: IIterableSource<Uint8Array>;
  activeCount: number;
  lastUsed: number;
};

export class MultiIterableSource<T extends ISerializedIterableSource, P>
  implements ISerializedIterableSource
{
  public readonly sourceType = "serialized";
  private SourceConstructor: IterableSourceConstructor<T, P>;
  private dataSource: MultiSource;
  // Stable per-source proxies handed to the merge/backfill/sort logic. Their getStart/getEnd
  // return cached times, so they keep working even while the underlying source is terminated.
  private sourceImpl: IIterableSource<Uint8Array>[] = [];

  // Lifecycle records backing each proxy; at most `#maxResidentSources` keep a live instance.
  #records: SourceRecord<P>[] = [];
  #lruClock = 0;
  #maxResidentSources: number;

  public constructor(dataSource: MultiSource, SourceConstructor: IterableSourceConstructor<T, P>) {
    this.dataSource = dataSource;
    this.SourceConstructor = SourceConstructor;
    const maxResident = dataSource.maxResidentSources ?? DEFAULT_MAX_RESIDENT_SOURCES;
    this.#maxResidentSources = Math.max(1, maxResident);
  }

  private async loadMultipleSources(): Promise<Initialization[]> {
    const sourceArgs: P[] = this.#buildSourceArgs();

    this.#records = sourceArgs.map((args) => ({ args, activeCount: 0, lastUsed: 0 }));
    this.sourceImpl = this.#records.map((record) => this.#makeProxy(record));

    // Bound how many sources initialize at once, and terminate each one as soon as its metadata
    // is captured so no more than `#maxResidentSources` parsed readers coexist. Promise.all
    // preserves input order regardless of completion order.
    const initConcurrency: number = this.dataSource.initConcurrency ?? DEFAULT_INIT_CONCURRENCY;
    const queue = new RequestQueue(initConcurrency);
    const initializations: Initialization[] = await Promise.all(
      this.#records.map(
        async (record) =>
          await queue.run(async () => {
            const source = new this.SourceConstructor(record.args);
            const initialization = await source.initialize();
            record.start = source.getStart?.();
            record.end = source.getEnd?.();
            record.instance = source;
            record.lastUsed = ++this.#lruClock;
            this.#evict();
            return initialization;
          }),
      ),
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

  // Releases every sub-source's retained memory (parsed readers, caches).
  public async terminate(): Promise<void> {
    await Promise.all(this.sourceImpl.map(async (source) => await source.terminate?.()));
  }

  // Builds the constructor args for each sub-source (cache budget split for remote urls).
  #buildSourceArgs(): P[] {
    if (this.dataSource.type === "files") {
      return this.dataSource.files.map((file) => ({ type: "file", file }) as P);
    }

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

    return this.dataSource.urls.map(
      (url) => ({ type: "url", url, cacheSizeInBytes: perSourceCache, readAheadEnabled }) as P,
    );
  }

  // A stable proxy whose iterators lazily (re)create the underlying source and ref-count its use.
  #makeProxy(record: SourceRecord<P>): IIterableSource<Uint8Array> {
    return {
      initialize: async (): Promise<Initialization> => {
        throw new Error("Invariant: managed source proxy is not initialized directly");
      },
      getStart: () => record.start,
      getEnd: () => record.end,
      messageIterator: (opt) => this.#iterate(record, opt),
      getBackfillMessages: async (args) => await this.#backfill(record, args),
      terminate: async () => {
        await record.instance?.terminate?.();
        record.instance = undefined;
      },
    };
  }

  async *#iterate(
    record: SourceRecord<P>,
    opt: Immutable<MessageIteratorArgs>,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    const source = await this.#acquire(record);
    try {
      yield* source.messageIterator(opt);
    } finally {
      this.#release(record);
    }
  }

  async #backfill(
    record: SourceRecord<P>,
    args: Immutable<GetBackfillMessagesArgs>,
  ): Promise<MessageEvent<Uint8Array>[]> {
    const source = await this.#acquire(record);
    try {
      return await source.getBackfillMessages(args);
    } finally {
      this.#release(record);
    }
  }

  // Ensures the record's source is initialized and marks it in-use. The active reservation is
  // taken before awaiting init so a concurrent eviction cannot terminate this source.
  async #acquire(record: SourceRecord<P>): Promise<IIterableSource<Uint8Array>> {
    record.activeCount++;
    record.lastUsed = ++this.#lruClock;
    try {
      if (!record.instance) {
        const source = new this.SourceConstructor(record.args);
        await source.initialize();
        record.start ??= source.getStart?.();
        record.end ??= source.getEnd?.();
        record.instance = source;
      }
      return record.instance;
    } catch (err) {
      record.activeCount--;
      throw err;
    }
  }

  #release(record: SourceRecord<P>): void {
    record.activeCount = Math.max(0, record.activeCount - 1);
    this.#evict();
  }

  // Terminates least-recently-used inactive sources until at most `#maxResidentSources` remain.
  // Active sources are never evicted, so the resident count may transiently exceed the cap.
  #evict(): void {
    const resident = this.#records.filter((record) => record.instance != undefined);
    const overBy = resident.length - this.#maxResidentSources;
    if (overBy <= 0) {
      return;
    }
    const evictable = resident
      .filter((record) => record.activeCount === 0)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    for (const record of evictable.slice(0, overBy)) {
      void record.instance?.terminate?.();
      record.instance = undefined;
    }
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
