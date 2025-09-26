// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@lichtblick/suite";
import { BATCH_INTERVAL_MS } from "@lichtblick/suite-base/components/PanelExtensionAdapter/contants";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";

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
  const mockTopic = `/${BasicBuilder.string()}`;
  const mockSortedTopics = [PlayerBuilder.topic({ name: mockTopic })];
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
    const mockMessage: MessageEvent = MessageEventBuilder.messageEvent({ topic: mockTopic });

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
    const convertTo = BasicBuilder.string();

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
      MessageEventBuilder.messageEvent({ topic: mockTopic, receiveTime: { sec: 1, nsec: 0 } }),
      MessageEventBuilder.messageEvent({
        topic: mockTopic,
        receiveTime: { sec: 1, nsec: 1000000 }, // 1ms later
      }),
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

  it("should properly cancel during iteration", async () => {
    const mockMessages: MessageEvent[] = Array.from({ length: 10 }, (_, i) =>
      MessageEventBuilder.messageEvent({
        topic: mockTopic,
        receiveTime: { sec: 1, nsec: i * 1000000 },
        message: { data: `test${i}` },
      }),
    );

    // Create an iterator that yields slowly to allow cancellation
    async function* slowIterator(): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (const msg of mockMessages) {
        yield {
          type: "message-event",
          msgEvent: msg,
        };
        // Delay to allow cancellation between yields
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    const { iterable, cancel } = createMessageRangeIterator({
      topic: mockTopic,
      rawBatchIterator: slowIterator(),
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    const batches: MessageEvent[][] = [];
    const iterator = iterable[Symbol.asyncIterator]();

    // Get first result
    const firstResult = await iterator.next();
    expect(firstResult.done).toBe(false);
    if (firstResult.done !== true) {
      batches.push(firstResult.value);
    }

    // Cancel immediately
    cancel();

    // Try to get next batch - should be cancelled
    const secondResult = await iterator.next();
    expect(secondResult.done).toBe(true);

    // Should have received limited results due to cancellation
    expect(batches.length).toBeGreaterThan(0);
    const totalMessages = batches.flat().length;
    expect(totalMessages).toBeLessThan(mockMessages.length); // Should not have processed all messages
  });

  it("should yield batches after 16ms timeout", async () => {
    const mockMessages: MessageEvent[] = Array.from({ length: 5 }, (_, i) =>
      MessageEventBuilder.messageEvent({
        topic: mockTopic,
        schemaName: "test_schema",
        receiveTime: { sec: 1, nsec: i * 1000000 },
        message: { data: `test${i}` },
        sizeInBytes: 100,
      }),
    );

    // Create an iterator with artificial delays to trigger time-based batching
    let mockTime = 0;
    const performanceNowSpy = jest.spyOn(performance, "now").mockImplementation(() => mockTime);

    // Create an iterator that advances mock time to trigger time-based batching
    async function* timedIterator(): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (let i = 0; i < mockMessages.length; i++) {
        yield {
          type: "message-event",
          msgEvent: mockMessages[i]!,
        };

        // Add a delay after the second message to trigger 16ms batching
        if (i === 1) {
          mockTime += BATCH_INTERVAL_MS + 1; // Ensure we exceed the threshold
        }
      }
    }

    try {
      const { iterable } = createMessageRangeIterator({
        topic: mockTopic,
        rawBatchIterator: timedIterator(),
        sortedTopics: mockSortedTopics,
        messageConverters: mockMessageConverters,
      });

      const batches: MessageEvent[][] = [];
      for await (const batch of iterable) {
        batches.push([...batch]);
      }

      // Should have multiple batches due to time-based splitting
      expect(batches.length).toBeGreaterThan(1);

      // All messages should be received
      const allMessages = batches.flat();
      expect(allMessages).toHaveLength(mockMessages.length);
    } finally {
      performanceNowSpy.mockRestore();
    }
  });

  it("should handle message conversion when converters are available", async () => {
    const mockMessage: MessageEvent = MessageEventBuilder.messageEvent({ topic: mockTopic });

    const { convertMessage, collateTopicSchemaConversions } =
      jest.requireMock("./messageProcessing");

    // Mock to include topic schema converters
    collateTopicSchemaConversions.mockReturnValue({
      topicSchemaConverters: new Map([["test_key", jest.fn()]]),
      unconvertedSubscriptionTopics: new Set(),
    });

    const rawBatchIterator = createMockRawBatchIterator([
      {
        type: "message-event",
        msgEvent: mockMessage,
      },
    ]);

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

    // Should have called convertMessage since topicSchemaConverters is not empty
    expect(convertMessage).toHaveBeenCalledWith(mockMessage, expect.any(Map), expect.any(Array));
  });

  it("should yield final batch of remaining messages", async () => {
    const mockMessages: MessageEvent[] = [
      MessageEventBuilder.messageEvent({
        topic: mockTopic,
        receiveTime: { sec: 1, nsec: 0 },
        message: { data: "test1" },
      }),
      MessageEventBuilder.messageEvent({
        topic: mockTopic,
        receiveTime: { sec: 1, nsec: 1000000 },
        message: { data: "test2" },
      }),
    ];

    // Create an iterator that finishes quickly to test final batch handling
    async function* quickIterator(): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (const msg of mockMessages) {
        yield {
          type: "message-event",
          msgEvent: msg,
        };
      }
    }

    const { iterable } = createMessageRangeIterator({
      topic: mockTopic,
      rawBatchIterator: quickIterator(),
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    const batches: MessageEvent[][] = [];
    for await (const batch of iterable) {
      batches.push(batch);
    }

    // Should receive at least one batch with all messages
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const allMessages = batches.flat();
    expect(allMessages).toHaveLength(2);
    expect(allMessages[0]!.message).toEqual(mockMessages[0]!.message);
    expect(allMessages[1]!.message).toEqual(mockMessages[1]!.message);
  });

  it("should handle errors gracefully", async () => {
    (console.error as jest.Mock).mockImplementation(() => {});

    // Create an iterator that throws an error
    async function* errorIterator(): AsyncIterableIterator<Readonly<IteratorResult>> {
      //Simulate delay to send a batch
      await new Promise((resolve) => setTimeout(resolve, 20));

      yield {
        type: "message-event",
        msgEvent: {
          topic: mockTopic,
          schemaName: "test_schema",
          receiveTime: { sec: 1, nsec: 0 },
          message: { data: "test" },
          sizeInBytes: 100,
        },
      };
      throw new Error("Test error");
    }

    const { iterable } = createMessageRangeIterator({
      topic: mockTopic,
      rawBatchIterator: errorIterator(),
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    const batches: MessageEvent[][] = [];

    // Should not throw, but handle error gracefully
    for await (const batch of iterable) {
      batches.push(batch);
    }

    // Should have received one batch before the error
    expect(batches).toHaveLength(1);

    expect(console.error).toHaveBeenCalledWith(
      "Error in createMessageRangeIterator:",
      expect.any(Error),
    );

    (console.error as jest.Mock).mockReset();
  });

  it("should not yield remaining messages when cancelled", async () => {
    const mockMessages: MessageEvent[] = MessageEventBuilder.messageEvents();

    async function* interruptibleIterator(): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (const msg of mockMessages) {
        yield {
          type: "message-event",
          msgEvent: msg,
        };
      }
    }

    const { iterable, cancel } = createMessageRangeIterator({
      topic: mockTopic,
      rawBatchIterator: interruptibleIterator(),
      sortedTopics: mockSortedTopics,
      messageConverters: mockMessageConverters,
    });

    // Cancel before starting iteration
    cancel();

    const batches: MessageEvent[][] = [];
    for await (const batch of iterable) {
      batches.push(batch);
    }

    // Should not yield any batches since it was cancelled before starting
    expect(batches).toHaveLength(0);
  });
});
