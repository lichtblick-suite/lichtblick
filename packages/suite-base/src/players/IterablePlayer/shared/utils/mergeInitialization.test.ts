// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  InitMetadata,
  InitTopicStatsMap,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/types";
import {
  accumulateMap,
  mergeMetadata,
  mergeTopicStats,
  setEndTime,
  setStartTime,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/utils/mergeInitialization";
import { TopicStats } from "@lichtblick/suite-base/players/types";
import InitilizationSourceBuilder from "@lichtblick/suite-base/testing/builders/InitilizationSourceBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("mergeInitialization utils", () => {
  describe("setStartTime", () => {
    it("should return the earlier time", () => {
      const time1 = RosTimeBuilder.time({ sec: BasicBuilder.number({ max: 10 }) });
      const time2 = RosTimeBuilder.time({ sec: BasicBuilder.number({ min: 20 }) });

      expect(setStartTime(time1, time2)).toEqual(time1);
      expect(setStartTime(time2, time1)).toEqual(time1);
    });

    it("should return the time if they are equal", () => {
      const time1 = RosTimeBuilder.time();
      const time2 = time1;

      expect(time1).toEqual(time2);
      expect(setStartTime(time1, time2)).toEqual(time1);
      expect(setStartTime(time2, time1)).toEqual(time1);
    });
  });

  describe("setEndTime", () => {
    it("should return the later time", () => {
      const time1 = RosTimeBuilder.time({ sec: BasicBuilder.number({ max: 10 }) });
      const time2 = RosTimeBuilder.time({ sec: BasicBuilder.number({ min: 20 }) });

      expect(setEndTime(time1, time2)).toEqual(time2);
      expect(setEndTime(time2, time1)).toEqual(time2);
    });

    it("should return the time if they are equal", () => {
      const time1 = RosTimeBuilder.time();
      const time2 = time1;

      expect(time1).toEqual(time2);
      expect(setEndTime(time1, time2)).toEqual(time1);
      expect(setEndTime(time2, time1)).toEqual(time1);
    });
  });

  describe("mergeMetadata", () => {
    it("should merge two metadata arrays", () => {
      const metadata1: InitMetadata = InitilizationSourceBuilder.metadataList(1);
      const metadata2: InitMetadata = InitilizationSourceBuilder.metadataList(1);

      const result = mergeMetadata(metadata1, metadata2);

      expect(result!.length).toBe(2);
      expect(result![0]).toEqual(metadata1[0]);
      expect(result![1]).toEqual(metadata2[0]);
    });

    it("should handle undefined metadata", () => {
      const metadata1: InitMetadata = InitilizationSourceBuilder.metadataList(1);
      const metadata2: InitMetadata = undefined;

      const result = mergeMetadata(metadata1, metadata2);

      expect(result!.length).toBe(1);
      expect(result![0]).toEqual(metadata1[0]);
    });

    it("should handle undefined metadata in both", () => {
      const metadata1: InitMetadata = undefined;
      const metadata2: InitMetadata = undefined;

      const result = mergeMetadata(metadata1, metadata2);

      expect(result).toEqual([]);
    });
  });

  describe("accumulateMap", () => {
    it("should merge two maps", () => {
      const map1 = new Map<string, number>([["key1", 1]]);
      const map2 = new Map<string, number>([["key2", 2]]);

      const result = accumulateMap(map1, map2);

      expect(result.size).toBe(2);
      expect(result.get("key1")).toBe(1);
      expect(result.get("key2")).toBe(2);
    });
  });

  describe("mergeTopicStats", () => {
    it("should merge two topic stats maps and set correct first and last message time", () => {
      const topic1 = BasicBuilder.string();
      const topic2 = BasicBuilder.string();
      const statsMap1: InitTopicStatsMap = new Map<string, TopicStats>();
      statsMap1.set(topic1, {
        numMessages: 5,
        firstMessageTime: RosTimeBuilder.time({ sec: 10 }),
        lastMessageTime: RosTimeBuilder.time({ sec: 30 }),
      });
      statsMap1.set(topic2, {
        numMessages: 500,
        firstMessageTime: RosTimeBuilder.time({ sec: 10 }),
        lastMessageTime: RosTimeBuilder.time({ sec: 30 }),
      });
      const statsMap2: InitTopicStatsMap = new Map<string, TopicStats>();
      statsMap2.set(topic1, { numMessages: 3, firstMessageTime: RosTimeBuilder.time({ sec: 1 }) });
      statsMap2.set(topic2, { numMessages: 7, lastMessageTime: RosTimeBuilder.time({ sec: 20 }) });

      const result = mergeTopicStats(statsMap1, statsMap2);

      expect(result.get(topic1)).toEqual({
        numMessages: 8,
        firstMessageTime: { sec: 1, nsec: expect.any(Number) },
        lastMessageTime: { sec: 30, nsec: expect.any(Number) },
      });
      expect(result.get(topic2)).toEqual({
        numMessages: 507,
        firstMessageTime: { sec: 10, nsec: expect.any(Number) },
        lastMessageTime: { sec: 30, nsec: expect.any(Number) },
      });
    });
  });
});
