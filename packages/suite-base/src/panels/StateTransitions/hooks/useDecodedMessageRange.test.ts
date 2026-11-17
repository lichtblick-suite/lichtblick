/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { MessageEvent, SubscribeMessageRangeArgs } from "@lichtblick/suite";
import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useSubscribeMessageRange } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";

import { useDecodedMessageRange } from "./useDecodedMessageRange";

jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems");
jest.mock("@lichtblick/suite-base/components/PanelExtensionAdapter");

// Maps every message of a topic to an item of the `<topic>.field` path, like the real decoder.
function fakeDecode(
  messagesByTopic: Record<string, readonly MessageEvent[]>,
): MessageDataItemsByPath {
  const out: Record<string, { messageEvent: MessageEvent; queriedData: [] }[]> = {};
  for (const [topic, messages] of Object.entries(messagesByTopic)) {
    out[`${topic}.field`] = messages.map((messageEvent) => ({ messageEvent, queriedData: [] }));
  }
  return out;
}

function decodedMessagesOf(
  decoded: MessageDataItemsByPath[],
  path: string,
): MessageEvent[] | undefined {
  return decoded[0]?.[path]?.map(({ messageEvent }) => messageEvent);
}

describe("useDecodedMessageRange", () => {
  let mockSubscribeMessageRange: jest.Mock;
  let mockDecodeMessagePathsForMessagesByTopic: jest.Mock;
  let mockCancel: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockCancel = jest.fn();
    mockSubscribeMessageRange = jest.fn().mockReturnValue(mockCancel);
    mockDecodeMessagePathsForMessagesByTopic = jest.fn(fakeDecode);

    (useSubscribeMessageRange as jest.Mock).mockReturnValue(mockSubscribeMessageRange);
    (useDecodeMessagePathsForMessagesByTopic as jest.Mock).mockReturnValue(
      mockDecodeMessagePathsForMessagesByTopic,
    );
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
    const topicA = PlayerBuilder.topic().name;
    const topicB = PlayerBuilder.topic().name;

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
    const topic = PlayerBuilder.topic().name;

    const { unmount } = renderHook(() => useDecodedMessageRange([topic], [`${topic}.field`]));

    unmount();

    expect(mockCancel).toHaveBeenCalled();
  });

  it("should accumulate messages and decode after flush", async () => {
    const topic = PlayerBuilder.topic().name;

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
    expect(decodedMessagesOf(result.current, `${topic}.field`)).toEqual(msgs);
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
    const topic = PlayerBuilder.topic().name;

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
      const topicA = PlayerBuilder.topic().name;
      const topicB = PlayerBuilder.topic().name;

      const initialTopics = [topicA];
      const initialPaths = [`${topicA}.field`];

      const { result, rerender } = renderHook(
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

      expect(decodedMessagesOf(result.current, `${topicA}.field`)).toEqual(msgsA);
      expect(decodedMessagesOf(result.current, `${topicB}.field`)).toEqual(msgsB);
    });

    it("should only cancel the removed topic and preserve remaining topic data", async () => {
      const topicA = PlayerBuilder.topic().name;
      const topicB = PlayerBuilder.topic().name;

      const cancelA = jest.fn();
      const cancelB = jest.fn();
      mockSubscribeMessageRange.mockReturnValueOnce(cancelA).mockReturnValueOnce(cancelB);

      const { result, rerender } = renderHook(
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

      expect(decodedMessagesOf(result.current, `${topicA}.field`)).toEqual(msgsA);
      expect(result.current[0]).not.toHaveProperty([`${topicB}.field`]);
    });

    it("should not resubscribe to topics that remain unchanged", async () => {
      const topicA = PlayerBuilder.topic().name;
      const topicB = PlayerBuilder.topic().name;
      const topicC = PlayerBuilder.topic().name;

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
      const topicA = PlayerBuilder.topic().name;

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

  describe("incremental decoding", () => {
    function subscriptionArgs(topic: string): SubscribeMessageRangeArgs {
      const call = mockSubscribeMessageRange.mock.calls.find(
        ([args]: [SubscribeMessageRangeArgs]) => args.topic === topic,
      ) as [SubscribeMessageRangeArgs];
      return call[0];
    }

    it("should only decode messages that arrived since the previous flush", async () => {
      // Given
      const topic = PlayerBuilder.topic().name;
      const { result } = renderHook(() => useDecodedMessageRange([topic], [`${topic}.field`]));
      const first = [MessageEventBuilder.messageEvent({ topic })];
      const second = [
        MessageEventBuilder.messageEvent({ topic }),
        MessageEventBuilder.messageEvent({ topic }),
      ];
      let releaseSecond: () => void = () => {};
      const secondReady = new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
      const iterator = (async function* () {
        yield first;
        await secondReady;
        yield second;
      })();
      let done: Promise<void> = Promise.resolve();
      await act(async () => {
        done = subscriptionArgs(topic).onNewRangeIterator(iterator);
        await jest.advanceTimersByTimeAsync(250);
      });
      mockDecodeMessagePathsForMessagesByTopic.mockClear();

      // When
      await act(async () => {
        releaseSecond();
        await done;
      });

      // Then
      expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenCalledWith({ [topic]: second });
      expect(mockDecodeMessagePathsForMessagesByTopic).not.toHaveBeenCalledWith(
        expect.objectContaining({ [topic]: expect.arrayContaining(first) }),
      );
      expect(decodedMessagesOf(result.current, `${topic}.field`)).toEqual([...first, ...second]);
    });

    it("should decode everything again when the decoder changes", async () => {
      // Given
      const topic = PlayerBuilder.topic().name;
      const { result, rerender } = renderHook(() =>
        useDecodedMessageRange([topic], [`${topic}.field`]),
      );
      const msgs = [
        MessageEventBuilder.messageEvent({ topic }),
        MessageEventBuilder.messageEvent({ topic }),
      ];
      await act(async () => {
        await simulateBatches(topic, [msgs]);
      });
      const newDecode = jest.fn(fakeDecode);
      (useDecodeMessagePathsForMessagesByTopic as jest.Mock).mockReturnValue(newDecode);

      // When
      rerender();

      // Then
      expect(newDecode).toHaveBeenCalledWith({ [topic]: msgs });
      expect(decodedMessagesOf(result.current, `${topic}.field`)).toEqual(msgs);
    });

    it("should return the same result when re-rendered without new data", async () => {
      // Given
      const topic = PlayerBuilder.topic().name;
      const { result, rerender } = renderHook(() =>
        useDecodedMessageRange([topic], [`${topic}.field`]),
      );
      await act(async () => {
        await simulateBatches(topic, [[MessageEventBuilder.messageEvent({ topic })]]);
      });
      const before = result.current;

      // When
      rerender();

      // Then
      expect(result.current).toBe(before);
    });
  });

  describe("player readiness (empty arrays until ready)", () => {
    it("should not subscribe when topics and pathStrings are empty", () => {
      renderHook(() => useDecodedMessageRange([], []));

      expect(mockSubscribeMessageRange).not.toHaveBeenCalled();
    });

    it("should subscribe when transitioning from empty to non-empty arrays", () => {
      const topicA = PlayerBuilder.topic().name;

      const { rerender } = renderHook(
        ({ topics, paths }) => useDecodedMessageRange(topics, paths),
        { initialProps: { topics: [] as string[], paths: [] as string[] } },
      );

      expect(mockSubscribeMessageRange).not.toHaveBeenCalled();

      rerender({
        topics: [topicA],
        paths: [`${topicA}.field`],
      });

      expect(mockSubscribeMessageRange).toHaveBeenCalledTimes(1);
      expect(mockSubscribeMessageRange).toHaveBeenCalledWith(
        expect.objectContaining({ topic: topicA }),
      );
    });

    it("should receive and decode data after transitioning from empty to non-empty", async () => {
      const topicA = PlayerBuilder.topic().name;

      const { rerender } = renderHook(
        ({ topics, paths }) => useDecodedMessageRange(topics, paths),
        { initialProps: { topics: [] as string[], paths: [] as string[] } },
      );

      rerender({
        topics: [topicA],
        paths: [`${topicA}.field`],
      });

      const msgs = [
        MessageEventBuilder.messageEvent({ topic: topicA }),
        MessageEventBuilder.messageEvent({ topic: topicA }),
      ];

      await act(async () => {
        await simulateBatches(topicA, [msgs]);
      });

      expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
        expect.objectContaining({
          [topicA]: expect.arrayContaining(msgs),
        }),
      );
    });

    it("should not create duplicate subscriptions on multiple rerenders with same topics", () => {
      const topicA = PlayerBuilder.topic().name;

      const { rerender } = renderHook(
        ({ topics, paths }) => useDecodedMessageRange(topics, paths),
        { initialProps: { topics: [] as string[], paths: [] as string[] } },
      );

      const props = { topics: [topicA], paths: [`${topicA}.field`] };

      rerender(props);
      rerender(props);
      rerender(props);

      expect(mockSubscribeMessageRange).toHaveBeenCalledTimes(1);
    });
  });
});
