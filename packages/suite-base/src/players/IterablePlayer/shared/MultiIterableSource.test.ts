// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent, TopicSelection } from "@lichtblick/suite-base/players/types";
import InitializationSourceBuilder from "@lichtblick/suite-base/testing/builders/InitializationSourceBuilder";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import delay from "@lichtblick/suite-base/util/delay";
import { BasicBuilder } from "@lichtblick/test-builders";

import { IIterableSource, Initialization, ISerializedIterableSource } from "../IIterableSource";
import { HydratedSourcePool, SourceHydrator } from "./HydratedSourcePool";
import { MultiIterableSource } from "./MultiIterableSource";
import { MultiSource } from "./types";

const DEFAULT_READ_AHEAD_BUFFER_BYTES = 1024 * 1024 * 2;

// Capture log.warn so individual tests can assert on it.
// Variables whose names start with "mock" are hoisted by babel-jest alongside jest.mock(),
// so mockLogWarn is guaranteed to be defined before the factory executes.
const mockLogWarn = jest.fn();
jest.mock("@lichtblick/log", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    // Wrap in an arrow function so mockLogWarn is only read when log.warn() is actually
    // invoked during a test (after the `const mockLogWarn = jest.fn()` line has executed),
    // not at module-import time when jest.mock factories are evaluated.
    warn: (...args: unknown[]) => mockLogWarn(...args),
    error: jest.fn(),
  })),
}));

// Shared source-constructor mock that tracks concurrent initialize() calls so tests can assert on
// the effective initialization concurrency.
function trackInitConcurrency(): {
  implementation: () => jest.Mocked<IIterableSource>;
  getMaxInFlight: () => number;
} {
  let inFlight = 0;
  let maxInFlight = 0;
  const implementation = () =>
    ({
      initialize: jest.fn().mockImplementation(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(1);
        inFlight--;
        return InitializationSourceBuilder.initialization();
      }),
      messageIterator: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      getBackfillMessages: jest.fn().mockResolvedValue([]),
      getStart: jest.fn().mockReturnValue(RosTimeBuilder.time()),
      getEnd: jest.fn().mockReturnValue(RosTimeBuilder.time()),
    }) as jest.Mocked<IIterableSource>;
  return { implementation, getMaxInFlight: () => maxInFlight };
}

describe("MultiIterableSource", () => {
  let mockSourceConstructor: jest.Mock;
  let dataSource: MultiSource;
  beforeEach(() => {
    mockLogWarn.mockClear();
    mockSourceConstructor = jest.fn().mockImplementation(
      () =>
        ({
          initialize: jest.fn().mockResolvedValue(InitializationSourceBuilder.initialization()),
          messageIterator: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          getBackfillMessages: jest.fn().mockResolvedValue([]),
          getStart: jest.fn().mockReturnValue(RosTimeBuilder.time()),
          getEnd: jest.fn().mockReturnValue(RosTimeBuilder.time()),
        }) as jest.Mocked<IIterableSource>,
    );
    dataSource = {
      type: "files",
      files: [new Blob(), new Blob()],
    };
  });
  describe("loadMultipleSources", () => {
    it("should load multiple file sources", async () => {
      const file1 = new Blob([BasicBuilder.string()]);
      const file2 = new Blob([BasicBuilder.string()]);
      const multiSource = new MultiIterableSource(
        {
          type: "files",
          files: [file1, file2],
        },
        mockSourceConstructor,
      );

      const initializations = await multiSource["loadMultipleSources"]();

      expect(mockSourceConstructor).toHaveBeenCalledTimes(2);
      expect(mockSourceConstructor).toHaveBeenNthCalledWith(1, {
        type: "file",
        file: file1,
        pool: expect.any(HydratedSourcePool),
      });
      expect(mockSourceConstructor).toHaveBeenNthCalledWith(2, {
        type: "file",
        file: file2,
        pool: expect.any(HydratedSourcePool),
      });
      expect(initializations).toHaveLength(2);
    });
    it("should load multiple url sources", async () => {
      const url1 = BasicBuilder.string();
      const url2 = BasicBuilder.string();
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls: [url1, url2],
        },
        mockSourceConstructor,
      );

      const initializations = await multiSource["loadMultipleSources"]();

      expect(mockSourceConstructor).toHaveBeenCalledTimes(2);
      expect(mockSourceConstructor).toHaveBeenNthCalledWith(1, {
        type: "url",
        url: url1,
        cacheSizeInBytes: expect.any(Number),
        readAheadEnabled: true,
        readAheadBufferBytes: DEFAULT_READ_AHEAD_BUFFER_BYTES,
        pool: expect.any(HydratedSourcePool),
      });
      expect(mockSourceConstructor).toHaveBeenNthCalledWith(2, {
        type: "url",
        url: url2,
        cacheSizeInBytes: expect.any(Number),
        readAheadEnabled: true,
        readAheadBufferBytes: DEFAULT_READ_AHEAD_BUFFER_BYTES,
        pool: expect.any(HydratedSourcePool),
      });
      expect(initializations).toHaveLength(2);
    });
    it("should enable read-ahead by default for multi-url sources", async () => {
      // GIVEN: a multi-url source with three URLs.
      const urls = [BasicBuilder.string(), BasicBuilder.string(), BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: each constructed source keeps bounded speculative read-ahead enabled.
      expect(mockSourceConstructor.mock.calls[0]![0].readAheadEnabled).toBe(true);
      expect(mockSourceConstructor.mock.calls[1]![0].readAheadEnabled).toBe(true);
      expect(mockSourceConstructor.mock.calls[2]![0].readAheadEnabled).toBe(true);
    });
    it("should enable read-ahead by default for a single-url source", async () => {
      // GIVEN: a single-url source.
      const urls = [BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: the constructed source keeps legacy read-ahead behavior.
      expect(mockSourceConstructor.mock.calls[0]![0].readAheadEnabled).toBe(true);
    });
    it("should cap default multi-url readAheadBufferBytes at 2 MiB when per-source cache is larger", async () => {
      // GIVEN: a multi-url source whose per-source cache is far above 8 MiB.
      const urls = [BasicBuilder.string(), BasicBuilder.string(), BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: each source receives the 2 MiB default cap instead of a larger quarter-cache value.
      expect(mockSourceConstructor.mock.calls[0]![0].readAheadBufferBytes).toBe(
        DEFAULT_READ_AHEAD_BUFFER_BYTES,
      );
      expect(mockSourceConstructor.mock.calls[1]![0].readAheadBufferBytes).toBe(
        DEFAULT_READ_AHEAD_BUFFER_BYTES,
      );
      expect(mockSourceConstructor.mock.calls[2]![0].readAheadBufferBytes).toBe(
        DEFAULT_READ_AHEAD_BUFFER_BYTES,
      );
    });
    it("should bound default multi-url readAheadBufferBytes to one quarter of per-source cache when smaller than 2 MiB", async () => {
      // GIVEN: a multi-url source whose per-source cache works out to 4 MiB.
      const urls = [BasicBuilder.string(), BasicBuilder.string(), BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
          totalCacheSizeInBytes: 1024 * 1024 * 12,
          minCachePerSourceBytes: 1024 * 1024,
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: the bounded read-ahead uses floor(perSourceCache / 4) = 1 MiB.
      expect(mockSourceConstructor.mock.calls[0]![0].readAheadBufferBytes).toBe(1024 * 1024);
      expect(mockSourceConstructor.mock.calls[1]![0].readAheadBufferBytes).toBe(1024 * 1024);
      expect(mockSourceConstructor.mock.calls[2]![0].readAheadBufferBytes).toBe(1024 * 1024);
    });
    it("should leave single-url readAheadBufferBytes undefined to preserve legacy single-file behavior", async () => {
      // GIVEN: a single-url source.
      const urls = [BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: the downstream source falls back to getNewConnection's legacy 50 MiB default.
      expect(mockSourceConstructor.mock.calls[0]![0].readAheadBufferBytes).toBeUndefined();
    });
    it("should respect an explicit readAheadEnabled override for multi-url sources", async () => {
      // GIVEN: a multi-url source that explicitly opts into read-ahead.
      const urls = [BasicBuilder.string(), BasicBuilder.string(), BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
          readAheadEnabled: true,
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: the explicit value is preserved.
      expect(mockSourceConstructor.mock.calls[0]![0].readAheadEnabled).toBe(true);
      expect(mockSourceConstructor.mock.calls[1]![0].readAheadEnabled).toBe(true);
      expect(mockSourceConstructor.mock.calls[2]![0].readAheadEnabled).toBe(true);
    });
    it("should respect an explicit readAheadEnabled override for a single-url source", async () => {
      // GIVEN: a single-url source that explicitly opts out of read-ahead.
      const urls = [BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
          readAheadEnabled: false,
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: the explicit value overrides the single-url default of true.
      expect(mockSourceConstructor.mock.calls[0]![0].readAheadEnabled).toBe(false);
    });
    it("should bound default initialization concurrency for url sources", async () => {
      // GIVEN: more URL sources than the default remote initialization concurrency.
      const urls = Array.from({ length: 8 }, () => BasicBuilder.string());
      const { implementation, getMaxInFlight } = trackInitConcurrency();
      mockSourceConstructor.mockImplementation(implementation);
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
        },
        mockSourceConstructor,
      );

      // WHEN: initializing all remote sources.
      await multiSource["loadMultipleSources"]();

      // THEN: initialization runs concurrently but no more than four at a time.
      expect(getMaxInFlight()).toBeGreaterThan(1);
      expect(getMaxInFlight()).toBeLessThanOrEqual(4);
      expect(mockSourceConstructor).toHaveBeenCalledTimes(urls.length);
    });
    it("should bound default initialization concurrency for file sources", async () => {
      // GIVEN: more file sources than the default initialization concurrency.
      const files = Array.from({ length: 8 }, () => new Blob([BasicBuilder.string()]));
      const { implementation, getMaxInFlight } = trackInitConcurrency();
      mockSourceConstructor.mockImplementation(implementation);
      const multiSource = new MultiIterableSource(
        {
          type: "files",
          files,
        },
        mockSourceConstructor,
      );

      // WHEN: initializing all file sources.
      await multiSource["loadMultipleSources"]();

      // THEN: initialization runs concurrently but no more than the default of four at a time.
      expect(getMaxInFlight()).toBeGreaterThan(1);
      expect(getMaxInFlight()).toBeLessThanOrEqual(4);
      expect(mockSourceConstructor).toHaveBeenCalledTimes(files.length);
    });
    it("should respect explicit initialization concurrency for url sources", async () => {
      // GIVEN: a URL source with an explicit lower initialization concurrency.
      const urls = Array.from({ length: 6 }, () => BasicBuilder.string());
      const { implementation, getMaxInFlight } = trackInitConcurrency();
      mockSourceConstructor.mockImplementation(implementation);
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
          initConcurrency: 2,
        },
        mockSourceConstructor,
      );

      // WHEN: initializing all remote sources.
      await multiSource["loadMultipleSources"]();

      // THEN: the explicit concurrency override is enforced.
      expect(getMaxInFlight()).toBeLessThanOrEqual(2);
      expect(mockSourceConstructor).toHaveBeenCalledTimes(urls.length);
    });
    it("should allocate equal cache split when few sources do not trigger the minimum floor", async () => {
      // GIVEN: 2 URL sources with the default 500 MiB total cache budget.
      // floor(500 MiB / 2) = 250 MiB, which is well above the 10 MiB minimum floor,
      // so the linear split is used as-is and no warning should be emitted.
      const url1 = BasicBuilder.string();
      const url2 = BasicBuilder.string();
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls: [url1, url2],
          // totalCacheSizeInBytes defaults to 500 MiB, minCachePerSourceBytes defaults to 10 MiB
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: each source receives exactly 250 MiB (floor(500 / 2)),
      // and log.warn is not called because the budget is not exceeded
      const expected250Mib = 1024 * 1024 * 250;
      expect(mockSourceConstructor.mock.calls[0]![0].cacheSizeInBytes).toBe(expected250Mib);
      expect(mockSourceConstructor.mock.calls[1]![0].cacheSizeInBytes).toBe(expected250Mib);
      expect(mockLogWarn).not.toHaveBeenCalled();
    });
    it("should apply minimum floor cache per source when many sources would produce a sub-floor split", async () => {
      // GIVEN: 100 URL sources with an explicit 500 MiB total cache budget.
      // A pure linear split would give floor(500 MiB / 100) = 5 MiB per source,
      // which is below the 10 MiB minimum floor, so the floor must be applied instead.
      const urls = Array.from({ length: 100 }, () => BasicBuilder.string());
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
          totalCacheSizeInBytes: 1024 * 1024 * 500, // 500 MiB
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: every source gets the 10 MiB minimum, not the 5 MiB linear value,
      // and log.warn is emitted because 100 × 10 MiB = 1000 MiB exceeds the 500 MiB budget
      const min10Mib = 1024 * 1024 * 10;
      expect(mockSourceConstructor.mock.calls[0]![0].cacheSizeInBytes).toBe(min10Mib);
      expect(mockSourceConstructor.mock.calls[99]![0].cacheSizeInBytes).toBe(min10Mib);
      expect(mockLogWarn).toHaveBeenCalledTimes(1);
    });
    it("should respect custom minCachePerSourceBytes and warn when the total budget is exceeded", async () => {
      // GIVEN: 3 URL sources, totalCacheSizeInBytes = 6 MiB, minCachePerSourceBytes = 4 MiB.
      // A pure linear split gives floor(6 MiB / 3) = 2 MiB, which is below the 4 MiB custom
      // floor, so each source is allocated 4 MiB.  Because 4 MiB × 3 = 12 MiB > 6 MiB total,
      // the implementation must emit exactly one log.warn to signal the budget overrun.
      const url1 = BasicBuilder.string();
      const url2 = BasicBuilder.string();
      const url3 = BasicBuilder.string();
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls: [url1, url2, url3],
          totalCacheSizeInBytes: 1024 * 1024 * 6, // 6 MiB
          minCachePerSourceBytes: 1024 * 1024 * 4, // 4 MiB custom floor
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: each source gets 4 MiB (custom floor applied, not the 2 MiB linear split),
      // and exactly one log.warn is emitted because the total allocation exceeds the budget
      const expected4Mib = 1024 * 1024 * 4;
      expect(mockSourceConstructor.mock.calls[0]![0].cacheSizeInBytes).toBe(expected4Mib);
      expect(mockSourceConstructor.mock.calls[1]![0].cacheSizeInBytes).toBe(expected4Mib);
      expect(mockSourceConstructor.mock.calls[2]![0].cacheSizeInBytes).toBe(expected4Mib);
      expect(mockLogWarn).toHaveBeenCalledTimes(1);
    });
    it("should call initialize method for each iterable source", async () => {
      const multiSource = new MultiIterableSource(dataSource, mockSourceConstructor);
      await multiSource["loadMultipleSources"]();
      expect(mockSourceConstructor).toHaveBeenCalledTimes(2);
    });
  });
  describe("Initialization", () => {
    const mockInitialization = (initialization: Initialization) => {
      const mockSource = {
        initialize: jest.fn().mockResolvedValue(initialization),
        getStart: jest.fn().mockReturnValue(initialization.start),
        getEnd: jest.fn().mockReturnValue(initialization.end),
      };
      mockSourceConstructor.mockImplementationOnce(() => mockSource);
    };
    it("should merge initializations correctly with no alerts", async () => {
      const multiSource = new MultiIterableSource(dataSource, mockSourceConstructor);
      const dataTypeName = BasicBuilder.string();
      const dataType = { definitions: [{ name: "field1", type: "int64" }] };
      const topicName = BasicBuilder.string();
      const topic = { name: topicName, schemaName: BasicBuilder.string() };
      const init1 = InitializationSourceBuilder.initialization({
        start: RosTimeBuilder.time({ sec: 0 }),
        end: RosTimeBuilder.time({ sec: 20, nsec: 0 }),
        datatypes: new Map([[dataTypeName, dataType]]),
        topics: [topic],
        topicStats: new Map([[topicName, { numMessages: 10 }]]),
        metadata: [{ name: "key", metadata: { key: "value" } }],
      });
      const init2 = InitializationSourceBuilder.initialization({
        start: RosTimeBuilder.time({ sec: 20, nsec: 0 }),
        end: RosTimeBuilder.time({ sec: 40 }),
        datatypes: new Map([[dataTypeName, dataType]]),
        topics: [topic],
        topicStats: new Map([[topicName, { numMessages: 20 }]]),
        metadata: [{ name: "key", metadata: { key: "value2" } }],
      });

      mockInitialization(init1);
      mockInitialization(init2);

      const result = await multiSource.initialize();

      expect(result.start.sec).toBe(0);
      expect(result.end.sec).toBe(40);
      expect(result.datatypes.size).toBe(1);
      expect(result.topics).toHaveLength(1);
      expect(result.topicStats.size).toBe(1);
      expect(result.topicStats.get(topicName)!.numMessages).toBe(30);
      expect(result.metadata!).toHaveLength(2);
      expect(result.metadata).toContainEqual(init1.metadata![0]);
      expect(result.metadata).toContainEqual(init2.metadata![0]);
      expect(result.profile).toBe(init2.profile);
      expect(result.alerts).toHaveLength(0);

      expect(mockSourceConstructor).toHaveBeenCalledTimes(2);
    });

    it("should merge initializations, but containing alerts", async () => {
      const multiSource = new MultiIterableSource(dataSource, mockSourceConstructor);

      const dataTypeName = BasicBuilder.string();
      const topicName = BasicBuilder.string();

      const init1 = InitializationSourceBuilder.initialization({
        start: RosTimeBuilder.time({ sec: 0 }),
        end: RosTimeBuilder.time({ sec: 20 }),
        datatypes: new Map([[dataTypeName, { definitions: [{ name: "field1", type: "int64" }] }]]),
        topics: [{ name: topicName, schemaName: BasicBuilder.string() }],
      });
      const init2 = InitializationSourceBuilder.initialization({
        start: RosTimeBuilder.time({ sec: 10 }),
        end: RosTimeBuilder.time({ sec: 30 }),
        datatypes: new Map([[dataTypeName, { definitions: [{ name: "field1", type: "string" }] }]]),
        topics: [{ name: topicName, schemaName: BasicBuilder.string() }],
      });

      mockInitialization(init1);
      mockInitialization(init2);

      const result = await multiSource.initialize();

      expect(result.start.sec).toBe(0);
      expect(result.end.sec).toBe(30);
      expect(result.datatypes.size).toBe(1);
      expect(result.topics).toHaveLength(1);
      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0]!.message).toBe(
        `Different datatypes found for schema "${dataTypeName}"`,
      );

      expect(result.alerts[1]!.message).toBe(
        `Schema name mismatch detected for topic "${topicName}". Expected "${init1.topics[0]!.schemaName}", but found "${init2.topics[0]!.schemaName}".`,
      );

      expect(mockSourceConstructor).toHaveBeenCalledTimes(2);
    });
  });

  describe("getBackfillMessages", () => {
    const makeSource = (startSec: number, backfill: jest.Mock): IIterableSource<Uint8Array> => ({
      initialize: jest.fn(),
      messageIterator: jest.fn(),
      getBackfillMessages: backfill,
      getStart: jest.fn().mockReturnValue({ sec: startSec, nsec: 0 }),
      getEnd: jest.fn().mockReturnValue({ sec: startSec + 10, nsec: 0 }),
    });

    const messageOnTopic = (topic: string): MessageEvent<Uint8Array> =>
      MessageEventBuilder.messageEvent<Uint8Array>({ topic, message: new Uint8Array() });

    const topicSelection = (...topics: string[]): TopicSelection =>
      new Map(topics.map((topic) => [topic, { topic }]));

    it("should stop querying earlier sources once all requested topics are satisfied", async () => {
      // GIVEN: three time-sequential sources; the nearest (latest start) already has every topic.
      const farBackfill = jest.fn().mockResolvedValue([]);
      const midBackfill = jest.fn().mockResolvedValue([]);
      const nearBackfill = jest.fn().mockResolvedValue([messageOnTopic("a"), messageOnTopic("b")]);

      const multiSource = new MultiIterableSource(dataSource, mockSourceConstructor);
      multiSource["sourceImpl"] = [
        makeSource(0, farBackfill),
        makeSource(10, midBackfill),
        makeSource(20, nearBackfill),
      ];

      // WHEN: backfilling at a time covered by the nearest source.
      const result = await multiSource.getBackfillMessages({
        topics: topicSelection("a", "b"),
        time: { sec: 25, nsec: 0 },
      });

      // THEN: only the nearest source is queried; the redundant earlier sources are skipped.
      expect(nearBackfill).toHaveBeenCalledTimes(1);
      expect(midBackfill).not.toHaveBeenCalled();
      expect(farBackfill).not.toHaveBeenCalled();
      expect(result.map((message) => message.topic).sort((a, b) => a.localeCompare(b))).toEqual([
        "a",
        "b",
      ]);
    });

    it("should fall back to earlier sources only for topics missing from nearer ones", async () => {
      // GIVEN: the nearest source has only topic "a"; the middle source has "b".
      const farBackfill = jest.fn().mockResolvedValue([]);
      const midBackfill = jest.fn().mockResolvedValue([messageOnTopic("b")]);
      const nearBackfill = jest.fn().mockResolvedValue([messageOnTopic("a")]);

      const multiSource = new MultiIterableSource(dataSource, mockSourceConstructor);
      multiSource["sourceImpl"] = [
        makeSource(0, farBackfill),
        makeSource(10, midBackfill),
        makeSource(20, nearBackfill),
      ];

      // WHEN
      const result = await multiSource.getBackfillMessages({
        topics: topicSelection("a", "b"),
        time: { sec: 25, nsec: 0 },
      });

      // THEN: the nearest source is asked for both topics, the middle source is asked only for the
      // still-missing "b", and the farthest source is never reached.
      expect(
        [...nearBackfill.mock.calls[0]![0].topics.keys()].sort((a, b) => a.localeCompare(b)),
      ).toEqual(["a", "b"]);
      expect(
        [...midBackfill.mock.calls[0]![0].topics.keys()].sort((a, b) => a.localeCompare(b)),
      ).toEqual(["b"]);
      expect(farBackfill).not.toHaveBeenCalled();
      expect(result.map((message) => message.topic).sort((a, b) => a.localeCompare(b))).toEqual([
        "a",
        "b",
      ]);
    });

    it("should not query any source when there are no topics to backfill", async () => {
      // GIVEN: a source that would return messages if queried.
      const backfill = jest.fn().mockResolvedValue([messageOnTopic("a")]);
      const multiSource = new MultiIterableSource(dataSource, mockSourceConstructor);
      multiSource["sourceImpl"] = [makeSource(0, backfill)];

      // WHEN: backfilling with an empty topic selection.
      const result = await multiSource.getBackfillMessages({
        topics: topicSelection(),
        time: { sec: 25, nsec: 0 },
      });

      // THEN: nothing is fetched.
      expect(backfill).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("source sorting after initialize", () => {
    it("should fallback to {sec:0, nsec:0} when getStart is undefined", async () => {
      // Given two sources: one with getStart returning a time, one without getStart
      const sourceWithStart = {
        initialize: jest.fn().mockResolvedValue(
          InitializationSourceBuilder.initialization({
            start: RosTimeBuilder.time({ sec: 5, nsec: 0 }),
            end: RosTimeBuilder.time({ sec: 10, nsec: 0 }),
          }),
        ),
        messageIterator: jest.fn(),
        getBackfillMessages: jest.fn().mockResolvedValue([]),
        getStart: jest.fn().mockReturnValue({ sec: 5, nsec: 0 }),
        getEnd: jest.fn().mockReturnValue({ sec: 10, nsec: 0 }),
      };

      const sourceWithoutStart = {
        initialize: jest.fn().mockResolvedValue(
          InitializationSourceBuilder.initialization({
            start: RosTimeBuilder.time({ sec: 0, nsec: 0 }),
            end: RosTimeBuilder.time({ sec: 5, nsec: 0 }),
          }),
        ),
        messageIterator: jest.fn(),
        getBackfillMessages: jest.fn().mockResolvedValue([]),
        // getStart is intentionally omitted — triggers the ?? fallback
        getEnd: jest.fn().mockReturnValue({ sec: 5, nsec: 0 }),
      };

      // Source with start=5 is created first, source without getStart second
      mockSourceConstructor
        .mockImplementationOnce(() => sourceWithStart)
        .mockImplementationOnce(() => sourceWithoutStart);

      const multiSource = new MultiIterableSource(
        { type: "files", files: [new Blob(), new Blob()] },
        mockSourceConstructor,
      );

      // When initializing
      await multiSource.initialize();

      // Then source without getStart should sort first (fallback to sec:0)
      const sources = multiSource["sourceImpl"];
      expect(sources[0]).toBe(sourceWithoutStart);
      expect(sources[1]).toBe(sourceWithStart);
    });
  });

  describe("prewarm stress coverage", () => {
    it("resolves initialize after prewarming earliest sources that were evicted during multi-url initialization", async () => {
      // GIVEN: many URL sources sharing the real bounded HydratedSourcePool so the earliest
      // initialized sources must be evicted before initialize() finishes.
      const urls = Array.from({ length: 20 }, (_, index) => `https://example.com/${index}.mcap`);
      const openCounts = new Map<string, number>();
      const prewarmCounts = new Map<string, number>();

      type TestResidentValue = { url: string };
      type TestSourceArgs = { type: "url"; url: string; pool: HydratedSourcePool };

      class TestPooledSource implements ISerializedIterableSource {
        public readonly sourceType = "serialized";
        #url: string;
        #pool: HydratedSourcePool;
        #start = RosTimeBuilder.time();
        #end = RosTimeBuilder.time();

        public constructor(args: TestSourceArgs) {
          this.#url = args.url;
          this.#pool = args.pool;
        }

        readonly #hydrator: SourceHydrator<TestResidentValue> = {
          open: async () => {
            const index = Number.parseInt(this.#url.split("/").at(-1)!.replace(".mcap", ""), 10);
            openCounts.set(this.#url, (openCounts.get(this.#url) ?? 0) + 1);
            await delay(index);
            return { url: this.#url };
          },
          close: async (_value) => {
            await Promise.resolve();
          },
        };

        public async initialize(): Promise<Initialization> {
          const index = Number.parseInt(this.#url.split("/").at(-1)!.replace(".mcap", ""), 10);
          const value = await this.#hydrator.open();
          const initialization = InitializationSourceBuilder.initialization({
            start: RosTimeBuilder.time({ sec: index, nsec: 0 }),
            end: RosTimeBuilder.time({ sec: index + 1, nsec: 0 }),
          });
          this.#start = initialization.start;
          this.#end = initialization.end;
          await this.#pool.admit(this, this.#hydrator, value);
          return initialization;
        }

        public async *messageIterator(): AsyncIterableIterator<Readonly<never>> {
          yield* [];
        }

        public async getBackfillMessages() {
          return [];
        }

        public getStart() {
          return this.#start;
        }

        public getEnd() {
          return this.#end;
        }

        public async prewarm(): Promise<void> {
          prewarmCounts.set(this.#url, (prewarmCounts.get(this.#url) ?? 0) + 1);
          await this.#pool.acquire(this, this.#hydrator);
          this.#pool.release(this);
        }
      }

      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
        },
        TestPooledSource,
      );

      // WHEN: the real top-level initialize() sorts and prewarms the earliest sources.
      await expect(multiSource.initialize()).resolves.toBeDefined();

      // THEN: the three earliest-by-start sources were prewarmed exactly once and had to
      // re-acquire from the real pool after their first initialized residency was evicted.
      expect(prewarmCounts.get(urls[0]!)).toBe(1);
      expect(prewarmCounts.get(urls[1]!)).toBe(1);
      expect(prewarmCounts.get(urls[2]!)).toBe(1);
      expect(openCounts.get(urls[0]!)).toBe(2);
      expect(openCounts.get(urls[1]!)).toBe(2);
      expect(openCounts.get(urls[2]!)).toBe(2);
    }, 5000);
  });

  describe("HydratedSourcePool wiring", () => {
    it("should create a single shared pool and pass it to every url source", async () => {
      // GIVEN: a multi-url source with three URLs.
      const urls = [BasicBuilder.string(), BasicBuilder.string(), BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
        },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: every source receives the same pool instance.
      const pool = mockSourceConstructor.mock.calls[0]![0].pool;
      expect(pool).toBeInstanceOf(HydratedSourcePool);
      expect(mockSourceConstructor.mock.calls[1]![0].pool).toBe(pool);
      expect(mockSourceConstructor.mock.calls[2]![0].pool).toBe(pool);
    });

    it("should create a single shared pool and pass it to every file source", async () => {
      // GIVEN: a multi-file source with three files.
      const multiSource = new MultiIterableSource(
        { type: "files", files: [new Blob(), new Blob(), new Blob()] },
        mockSourceConstructor,
      );

      // WHEN
      await multiSource["loadMultipleSources"]();

      // THEN: every file source receives the same pool instance.
      const pool = mockSourceConstructor.mock.calls[0]![0].pool;
      expect(pool).toBeInstanceOf(HydratedSourcePool);
      expect(mockSourceConstructor.mock.calls[1]![0].pool).toBe(pool);
      expect(mockSourceConstructor.mock.calls[2]![0].pool).toBe(pool);
    });

    it("should honor a maxHydratedSources override without crashing", async () => {
      // GIVEN: a multi-url source with an explicit maxHydratedSources of 1.
      const urls = [BasicBuilder.string(), BasicBuilder.string(), BasicBuilder.string()];
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls,
          maxHydratedSources: 1,
        },
        mockSourceConstructor,
      );

      // WHEN: initializing all remote sources.
      const result = await multiSource.initialize();

      // THEN: a pool is still created and shared, and a merged initialization is returned.
      expect(mockSourceConstructor.mock.calls[0]![0].pool).toBeInstanceOf(HydratedSourcePool);
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it("should terminate all sources and tear down the pool", async () => {
      // GIVEN: url sources whose terminate is observable.
      const terminateSpy = jest.fn().mockResolvedValue(undefined);
      mockSourceConstructor.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(InitializationSourceBuilder.initialization()),
        messageIterator: jest.fn().mockResolvedValue({ done: true, value: undefined }),
        getBackfillMessages: jest.fn().mockResolvedValue([]),
        getStart: jest.fn().mockReturnValue(RosTimeBuilder.time()),
        getEnd: jest.fn().mockReturnValue(RosTimeBuilder.time()),
        terminate: terminateSpy,
      }));
      const multiSource = new MultiIterableSource(
        {
          type: "urls",
          urls: [BasicBuilder.string(), BasicBuilder.string()],
        },
        mockSourceConstructor,
      );
      await multiSource.initialize();

      // Spy on the shared pool captured from the first source construction.
      const pool = mockSourceConstructor.mock.calls[0]![0].pool as HydratedSourcePool;
      const poolTerminateSpy = jest.spyOn(pool, "terminate");

      // WHEN: terminating the multi-source.
      // THEN: it resolves, every source's terminate is called, and the pool is torn down after.
      await expect(multiSource.terminate()).resolves.toBeUndefined();
      expect(terminateSpy).toHaveBeenCalledTimes(2);
      expect(poolTerminateSpy).toHaveBeenCalledTimes(1);
      expect(terminateSpy.mock.invocationCallOrder[0]!).toBeLessThan(
        poolTerminateSpy.mock.invocationCallOrder[0]!,
      );
    });
  });
});
