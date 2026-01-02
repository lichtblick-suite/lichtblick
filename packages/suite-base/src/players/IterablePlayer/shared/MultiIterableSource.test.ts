// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MultiSource } from "@lichtblick/suite-base/players/IterablePlayer/shared/types";
import InitilizationSourceBuilder from "@lichtblick/suite-base/testing/builders/InitilizationSourceBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { MultiIterableSource } from "./MultiIterableSource";
import { IIterableSource, Initialization } from "../IIterableSource";

describe("MultiIterableSource", () => {
  let mockSourceConstructor: jest.Mock;
  let dataSource: MultiSource;
  beforeEach(() => {
    mockSourceConstructor = jest.fn().mockImplementation(
      () =>
        ({
          initialize: jest.fn().mockResolvedValue(InitilizationSourceBuilder.initialization()),
          messageIterator: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          getBackfillMessages: jest.fn().mockResolvedValue([]),
          getStart: jest.fn().mockResolvedValue(RosTimeBuilder.time()),
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
      });
      expect(mockSourceConstructor).toHaveBeenNthCalledWith(2, {
        type: "url",
        url: url2,
      });
      expect(initializations).toHaveLength(2);
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
        getStart: jest.fn().mockResolvedValue(initialization.start),
      };
      mockSourceConstructor.mockImplementationOnce(() => mockSource);
    };
    it("should merge initializations correctly with no alerts", async () => {
      const multiSource = new MultiIterableSource(dataSource, mockSourceConstructor);
      const dataTypeName = BasicBuilder.string();
      const dataType = { definitions: [{ name: "field1", type: "int64" }] };
      const topicName = BasicBuilder.string();
      const topic = { name: topicName, schemaName: BasicBuilder.string() };
      const init1 = InitilizationSourceBuilder.initialization({
        start: RosTimeBuilder.time({ sec: 0 }),
        end: RosTimeBuilder.time({ sec: 20, nsec: 0 }),
        datatypes: new Map([[dataTypeName, dataType]]),
        topics: [topic],
        topicStats: new Map([[topicName, { numMessages: 10 }]]),
        metadata: [{ name: "key", metadata: { key: "value" } }],
      });
      const init2 = InitilizationSourceBuilder.initialization({
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

      const init1 = InitilizationSourceBuilder.initialization({
        start: RosTimeBuilder.time({ sec: 0 }),
        end: RosTimeBuilder.time({ sec: 20 }),
        datatypes: new Map([[dataTypeName, { definitions: [{ name: "field1", type: "int64" }] }]]),
        topics: [{ name: topicName, schemaName: BasicBuilder.string() }],
      });
      const init2 = InitilizationSourceBuilder.initialization({
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
});
