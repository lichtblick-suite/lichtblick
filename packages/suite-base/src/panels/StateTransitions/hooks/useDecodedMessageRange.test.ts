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
});
