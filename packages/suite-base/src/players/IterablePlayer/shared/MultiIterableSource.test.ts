// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent, TopicSelection } from "@lichtblick/suite-base/players/types";
import InitializationSourceBuilder from "@lichtblick/suite-base/testing/builders/InitializationSourceBuilder";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { IIterableSource, Initialization } from "../IIterableSource";
import { MultiIterableSource } from "./MultiIterableSource";
import { MultiSource } from "./types";

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
      });
      expect(mockSourceConstructor).toHaveBeenNthCalledWith(2, {
        type: "file",
        file: file2,
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
        readAheadEnabled: false,
      });
      expect(mockSourceConstructor).toHaveBeenNthCalledWith(2, {
        type: "url",
        url: url2,
        cacheSizeInBytes: expect.any(Number),
        readAheadEnabled: false,
      });
      expect(initializations).toHaveLength(2);
    });
    it("should disable read-ahead by default for multi-url sources", async () => {
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

      // THEN: each constructed source opts out of speculative read-ahead.
      expect(mockSourceConstructor.mock.calls[0]![0].readAheadEnabled).toBe(false);
      expect(mockSourceConstructor.mock.calls[1]![0].readAheadEnabled).toBe(false);
      expect(mockSourceConstructor.mock.calls[2]![0].readAheadEnabled).toBe(false);
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

      // THEN: the explicit value overrides the multi-url default of false.
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
      expect(result.topics.length).toBe(1);
      expect(result.topicStats.size).toBe(1);
      expect(result.topicStats.get(topicName)!.numMessages).toBe(30);
      expect(result.metadata!.length).toBe(2);
      expect(result.metadata).toContainEqual(init1.metadata![0]);
      expect(result.metadata).toContainEqual(init2.metadata![0]);
      expect(result.profile).toBe(init2.profile);
      expect(result.alerts.length).toBe(0);

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
      expect(result.topics.length).toBe(1);
      expect(result.alerts.length).toBe(2);
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
});
