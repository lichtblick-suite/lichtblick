/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { MessageEvent, SubscribeMessageRangeArgs } from "@lichtblick/suite";
import { useDecodeMessagePathsForMessagesByTopic } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { useSubscribeMessageRange } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useDecodedMessageRange } from "./useDecodedMessageRange";

jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems");
jest.mock("@lichtblick/suite-base/components/PanelExtensionAdapter");
jest.mock("@lichtblick/suite-base/components/MessagePipeline");

describe("useDecodedMessageRange", () => {
  let mockSubscribeMessageRange: jest.Mock;
  let mockDecodeMessagePathsForMessagesByTopic: jest.Mock;
  let mockCancel: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockCancel = jest.fn();
    mockSubscribeMessageRange = jest.fn().mockReturnValue(mockCancel);
    mockDecodeMessagePathsForMessagesByTopic = jest.fn().mockReturnValue({});

    (useSubscribeMessageRange as jest.Mock).mockReturnValue(mockSubscribeMessageRange);
    (useDecodeMessagePathsForMessagesByTopic as jest.Mock).mockReturnValue(
      mockDecodeMessagePathsForMessagesByTopic,
    );
    (useMessagePipeline as jest.Mock).mockReturnValue(PlayerPresence.PRESENT);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function simulateBatches(topic: string, batches: MessageEvent[][]): Promise<void> {
    const call = mockSubscribeMessageRange.mock.calls.find(
      ([args]: [SubscribeMessageRangeArgs]) => args.topic === topic,
    ) as [SubscribeMessageRangeArgs] | undefined;
    if (call == undefined) {
      throw new Error(`No subscription found for topic "${topic}"`);
    }
    const args: SubscribeMessageRangeArgs = call[0];

    const batchIterator = (async function* () {
      for (const batch of batches) {
        yield batch;
      }
    })();

    await args.onNewRangeIterator(batchIterator);
  }

  it("should subscribe to each topic", () => {
    const topicA = BasicBuilder.string();
    const topicB = BasicBuilder.string();

    renderHook(() =>
      useDecodedMessageRange([topicA, topicB], [`${topicA}.field`, `${topicB}.field`]),
    );

    expect(mockSubscribeMessageRange).toHaveBeenCalledTimes(2);
    expect(mockSubscribeMessageRange).toHaveBeenCalledWith(
      expect.objectContaining({ topic: topicA }),
    );
    expect(mockSubscribeMessageRange).toHaveBeenCalledWith(
      expect.objectContaining({ topic: topicB }),
    );
  });

  it("should cancel subscriptions on unmount", () => {
    const topic = BasicBuilder.string();

    const { unmount } = renderHook(() => useDecodedMessageRange([topic], [`${topic}.field`]));

    unmount();

    expect(mockCancel).toHaveBeenCalled();
  });

  it("should accumulate messages and decode after flush", async () => {
    const topic = BasicBuilder.string();

    const { result } = renderHook(() => useDecodedMessageRange([topic], [`${topic}.field`]));

    const msgs = [
      MessageEventBuilder.messageEvent({ topic }),
      MessageEventBuilder.messageEvent({ topic }),
    ];

    await act(async () => {
      await simulateBatches(topic, [msgs]);
    });

    expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
      expect.objectContaining({
        [topic]: expect.arrayContaining(msgs),
      }),
    );
    expect(result.current).toEqual([{}]);
  });

  it("should handle empty topics", () => {
    (useDecodeMessagePathsForMessagesByTopic as jest.Mock).mockReturnValue(
      jest.fn().mockReturnValue({}),
    );

    const { result } = renderHook(() => useDecodedMessageRange([], []));

    expect(result.current).toEqual([{}]);
    expect(mockSubscribeMessageRange).not.toHaveBeenCalled();
  });

  it("should reset accumulated data when a new range iterator is provided", async () => {
    const topic = BasicBuilder.string();

    renderHook(() => useDecodedMessageRange([topic], [`${topic}.field`]));

    const firstBatch = [MessageEventBuilder.messageEvent({ topic })];
    const secondBatch = [MessageEventBuilder.messageEvent({ topic })];

    await act(async () => {
      await simulateBatches(topic, [firstBatch]);
    });

    const call = mockSubscribeMessageRange.mock.calls.find(
      ([args]: [SubscribeMessageRangeArgs]) => args.topic === topic,
    );
    const args: SubscribeMessageRangeArgs = call![0];

    await act(async () => {
      const newIterator = (async function* () {
        yield secondBatch;
      })();
      await args.onNewRangeIterator(newIterator);
    });

    expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
      expect.objectContaining({
        [topic]: secondBatch,
      }),
    );
  });

  describe("incremental topic diffing", () => {
    it("should preserve existing topic data when a new topic is added", async () => {
      const topicA = BasicBuilder.string();
      const topicB = BasicBuilder.string();

      const initialTopics = [topicA];
      const initialPaths = [`${topicA}.field`];

      const { rerender } = renderHook(
        ({ topics, paths }) => useDecodedMessageRange(topics, paths),
        { initialProps: { topics: initialTopics, paths: initialPaths } },
      );

      const msgsA = [
        MessageEventBuilder.messageEvent({ topic: topicA }),
        MessageEventBuilder.messageEvent({ topic: topicA }),
      ];

      await act(async () => {
        await simulateBatches(topicA, [msgsA]);
      });

      expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
        expect.objectContaining({ [topicA]: expect.arrayContaining(msgsA) }),
      );

      mockSubscribeMessageRange.mockClear();

      rerender({
        topics: [topicA, topicB],
        paths: [`${topicA}.field`, `${topicB}.field`],
      });

      expect(mockSubscribeMessageRange).toHaveBeenCalledTimes(1);
      expect(mockSubscribeMessageRange).toHaveBeenCalledWith(
        expect.objectContaining({ topic: topicB }),
      );

      const msgsB = [MessageEventBuilder.messageEvent({ topic: topicB })];

      await act(async () => {
        await simulateBatches(topicB, [msgsB]);
      });

      expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
        expect.objectContaining({
          [topicA]: expect.arrayContaining(msgsA),
          [topicB]: expect.arrayContaining(msgsB),
        }),
      );
    });

    it("should only cancel the removed topic and preserve remaining topic data", async () => {
      const topicA = BasicBuilder.string();
      const topicB = BasicBuilder.string();

      const cancelA = jest.fn();
      const cancelB = jest.fn();
      mockSubscribeMessageRange.mockReturnValueOnce(cancelA).mockReturnValueOnce(cancelB);

      const { rerender } = renderHook(
        ({ topics, paths }) => useDecodedMessageRange(topics, paths),
        {
          initialProps: {
            topics: [topicA, topicB],
            paths: [`${topicA}.field`, `${topicB}.field`],
          },
        },
      );

      const msgsA = [MessageEventBuilder.messageEvent({ topic: topicA })];
      const msgsB = [MessageEventBuilder.messageEvent({ topic: topicB })];

      await act(async () => {
        await simulateBatches(topicA, [msgsA]);
        await simulateBatches(topicB, [msgsB]);
      });

      rerender({
        topics: [topicA],
        paths: [`${topicA}.field`],
      });

      expect(cancelA).not.toHaveBeenCalled();
      expect(cancelB).toHaveBeenCalledTimes(1);

      expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
        expect.objectContaining({
          [topicA]: expect.arrayContaining(msgsA),
        }),
      );
      expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
        expect.not.objectContaining({
          [topicB]: expect.anything(),
        }),
      );
    });

    it("should not resubscribe to topics that remain unchanged", async () => {
      const topicA = BasicBuilder.string();
      const topicB = BasicBuilder.string();
      const topicC = BasicBuilder.string();

      const { rerender } = renderHook(
        ({ topics, paths }) => useDecodedMessageRange(topics, paths),
        {
          initialProps: {
            topics: [topicA, topicB],
            paths: [`${topicA}.field`, `${topicB}.field`],
          },
        },
      );

      await act(async () => {
        await simulateBatches(topicA, [[MessageEventBuilder.messageEvent({ topic: topicA })]]);
        await simulateBatches(topicB, [[MessageEventBuilder.messageEvent({ topic: topicB })]]);
      });

      expect(mockSubscribeMessageRange).toHaveBeenCalledTimes(2);
      mockSubscribeMessageRange.mockClear();

      rerender({
        topics: [topicA, topicC],
        paths: [`${topicA}.field`, `${topicC}.field`],
      });

      expect(mockSubscribeMessageRange).toHaveBeenCalledTimes(1);
      expect(mockSubscribeMessageRange).toHaveBeenCalledWith(
        expect.objectContaining({ topic: topicC }),
      );
    });

    it("should handle adding a topic that shares data with existing subscriptions", async () => {
      const topicA = BasicBuilder.string();

      const { rerender } = renderHook(
        ({ topics, paths }) => useDecodedMessageRange(topics, paths),
        { initialProps: { topics: [topicA], paths: [`${topicA}.field`] } },
      );

      const msgsA = [
        MessageEventBuilder.messageEvent({ topic: topicA }),
        MessageEventBuilder.messageEvent({ topic: topicA }),
        MessageEventBuilder.messageEvent({ topic: topicA }),
      ];

      await act(async () => {
        await simulateBatches(topicA, [msgsA]);
      });

      mockSubscribeMessageRange.mockClear();
      rerender({ topics: [topicA], paths: [`${topicA}.field`] });

      expect(mockSubscribeMessageRange).not.toHaveBeenCalled();

      expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
        expect.objectContaining({
          [topicA]: expect.arrayContaining(msgsA),
        }),
      );
    });
  });
});
