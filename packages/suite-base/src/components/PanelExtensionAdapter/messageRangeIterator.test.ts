// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@lichtblick/suite";

import { createMessageRangeIterator } from "./messageRangeIterator";
import { IteratorResult } from "../../players/IterablePlayer/IIterableSource";

// Mock the message processing module
jest.mock("./messageProcessing", () => ({
  convertMessage: jest.fn(),
  collateTopicSchemaConversions: jest.fn().mockReturnValue({
    topicSchemaConverters: new Map(),
    unconvertedSubscriptionTopics: new Set(),
  }),
}));

describe("createMessageRangeIterator", () => {
  const mockTopic = "/test_topic";
  const mockSortedTopics = [{ name: mockTopic, schemaName: "test_schema" }];
  const mockMessageConverters: never[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    // Update the mock to include our test topic in unconvertedSubscriptionTopics
    const { collateTopicSchemaConversions } = jest.requireMock("./messageProcessing");
    collateTopicSchemaConversions.mockReturnValue({
      topicSchemaConverters: new Map(),
      unconvertedSubscriptionTopics: new Set([mockTopic]),
    });
  });

  async function* createMockRawBatchIterator(
    results: IteratorResult[],
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    for (const result of results) {
      yield result;
    }
  }

  it("should create an iterable and cancel function", () => {
    const rawBatchIterator = createMockRawBatchIterator([]);

    const result = createMessageRangeIterator({
      topic: mockTopic,
      rawBatchIterator,
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    expect(result).toHaveProperty("iterable");
    expect(result).toHaveProperty("cancel");
    expect(typeof result.cancel).toBe("function");
  });

  it("should handle cancellation", async () => {
    const mockMessage: MessageEvent = {
      topic: mockTopic,
      schemaName: "test_schema",
      receiveTime: { sec: 1, nsec: 0 },
      message: { data: "test" },
      sizeInBytes: 100,
    };

    // Create a slow iterator to test cancellation
    async function* slowIterator(): AsyncIterableIterator<Readonly<IteratorResult>> {
      yield {
        type: "message-event",
        msgEvent: mockMessage,
      };

      yield {
        type: "message-event",
        msgEvent: mockMessage,
      };
    }

    const { iterable, cancel } = createMessageRangeIterator({
      topic: mockTopic,
      rawBatchIterator: slowIterator(),
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    const batches: MessageEvent[][] = [];
    const iterator = iterable[Symbol.asyncIterator]();

    // Get first batch
    const firstResult = await iterator.next();
    expect(firstResult.done).toBe(false);
    if (firstResult.done !== true) {
      batches.push(firstResult.value);
    }

    // Cancel before getting second batch
    cancel();

    // Try to get next batch - should be cancelled
    const secondResult = await iterator.next();
    expect(secondResult.done).toBe(true);

    // Should only have received the first batch
    expect(batches).toHaveLength(1);
  });

  it("should handle convertTo parameter", () => {
    const rawBatchIterator = createMockRawBatchIterator([]);
    const convertTo = "converted_schema";

    const result = createMessageRangeIterator({
      topic: mockTopic,
      convertTo,
      rawBatchIterator,
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    expect(result).toHaveProperty("iterable");
    expect(result).toHaveProperty("cancel");
  });

  it("should batch messages based on time", async () => {
    const mockMessages: MessageEvent[] = [
      {
        topic: mockTopic,
        schemaName: "test_schema",
        receiveTime: { sec: 1, nsec: 0 },
        message: { data: "test1" },
        sizeInBytes: 100,
      },
      {
        topic: mockTopic,
        schemaName: "test_schema",
        receiveTime: { sec: 1, nsec: 1000000 }, // 1ms later
        message: { data: "test2" },
        sizeInBytes: 100,
      },
    ];

    const results: IteratorResult[] = mockMessages.map((msg) => ({
      type: "message-event" as const,
      msgEvent: msg,
    }));

    const rawBatchIterator = createMockRawBatchIterator(results);
    const { iterable } = createMessageRangeIterator({
      topic: mockTopic,
      rawBatchIterator,
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    const batches: MessageEvent[][] = [];
    for await (const batch of iterable) {
      batches.push(batch);
    }

    // Should receive at least one batch with both messages
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const allMessages = batches.flat();
    expect(allMessages).toHaveLength(2);
  });

  it("should handle non-message-event results", async () => {
    const results: IteratorResult[] = [
      {
        type: "alert",
        connectionId: 1,
        alert: { severity: "info", message: "test alert" },
      },
      {
        type: "stamp",
        stamp: { sec: 1, nsec: 0 },
      },
    ];

    const rawBatchIterator = createMockRawBatchIterator(results);
    const { iterable } = createMessageRangeIterator({
      topic: mockTopic,
      rawBatchIterator,
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    const batches: MessageEvent[][] = [];
    for await (const batch of iterable) {
      batches.push(batch);
    }

    // Should not yield any batches since there are no message events
    expect(batches).toHaveLength(0);
  });
});
