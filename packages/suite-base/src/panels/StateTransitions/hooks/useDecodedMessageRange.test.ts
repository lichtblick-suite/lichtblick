/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { MessageEvent, SubscribeMessageRangeArgs } from "@lichtblick/suite";
import { useDecodeMessagePathsForMessagesByTopic } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { useSubscribeMessageRange } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useDecodedMessageRange } from "./useDecodedMessageRange";
import { StateTransitionPath } from "../types";

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

  function buildMessageEvent(topic: string): MessageEvent {
    return {
      message: BasicBuilder.string(),
      receiveTime: RosTimeBuilder.time(),
      schemaName: BasicBuilder.string(),
      sizeInBytes: BasicBuilder.number(),
      topic,
    };
  }

  function buildStateTransitionPath(
    overrideProps: Partial<StateTransitionPath> = {},
  ): StateTransitionPath {
    return {
      timestampMethod: BasicBuilder.sample(["receiveTime", "headerStamp"]),
      value: BasicBuilder.string(),
      enabled: true,
      label: BasicBuilder.string(),
      ...overrideProps,
    };
  }

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

  it("should subscribe to topics parsed from paths", () => {
    const paths: StateTransitionPath[] = [
      buildStateTransitionPath({ value: "/topic_a.field" }),
      buildStateTransitionPath({ value: "/topic_b.field" }),
    ];

    renderHook(() => useDecodedMessageRange(paths));

    expect(mockSubscribeMessageRange).toHaveBeenCalledTimes(2);
    expect(mockSubscribeMessageRange).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "/topic_a" }),
    );
    expect(mockSubscribeMessageRange).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "/topic_b" }),
    );
  });

  it("should deduplicate topics from multiple paths", () => {
    const paths: StateTransitionPath[] = [
      buildStateTransitionPath({ value: "/topic_a.field1" }),
      buildStateTransitionPath({ value: "/topic_a.field2" }),
    ];

    renderHook(() => useDecodedMessageRange(paths));

    expect(mockSubscribeMessageRange).toHaveBeenCalledTimes(1);
    expect(mockSubscribeMessageRange).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "/topic_a" }),
    );
  });

  it("should cancel subscriptions on unmount", () => {
    const paths: StateTransitionPath[] = [buildStateTransitionPath({ value: "/topic_a.field" })];

    const { unmount } = renderHook(() => useDecodedMessageRange(paths));

    unmount();

    expect(mockCancel).toHaveBeenCalled();
  });

  it("should accumulate messages and decode after flush", async () => {
    const paths: StateTransitionPath[] = [buildStateTransitionPath({ value: "/topic_a.field" })];

    const { result } = renderHook(() => useDecodedMessageRange(paths));

    const msgs = [buildMessageEvent("/topic_a"), buildMessageEvent("/topic_a")];

    await act(async () => {
      await simulateBatches("/topic_a", [msgs]);
    });

    // After iterator completes, final flush is called synchronously
    expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
      expect.objectContaining({
        "/topic_a": expect.arrayContaining(msgs),
      }),
    );
    expect(result.current).toEqual([{}]);
  });

  it("should handle empty paths", () => {
    (useDecodeMessagePathsForMessagesByTopic as jest.Mock).mockReturnValue(
      jest.fn().mockReturnValue({}),
    );

    const { result } = renderHook(() => useDecodedMessageRange([]));

    expect(result.current).toEqual([{}]);
    expect(mockSubscribeMessageRange).not.toHaveBeenCalled();
  });

  it("should reset accumulated data when a new range iterator is provided", async () => {
    const paths: StateTransitionPath[] = [buildStateTransitionPath({ value: "/topic_a.field" })];

    renderHook(() => useDecodedMessageRange(paths));

    const firstBatch = [buildMessageEvent("/topic_a")];
    const secondBatch = [buildMessageEvent("/topic_a")];

    // First iterator delivers messages
    await act(async () => {
      await simulateBatches("/topic_a", [firstBatch]);
    });

    // Simulate a new range iterator (e.g., seek) — call onNewRangeIterator again
    const call = mockSubscribeMessageRange.mock.calls.find(
      ([args]: [SubscribeMessageRangeArgs]) => args.topic === "/topic_a",
    );
    const args: SubscribeMessageRangeArgs = call![0];

    await act(async () => {
      const newIterator = (async function* () {
        yield secondBatch;
      })();
      await args.onNewRangeIterator(newIterator);
    });

    // Should only have second batch data, not first + second
    expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenLastCalledWith(
      expect.objectContaining({
        "/topic_a": secondBatch,
      }),
    );
  });
});
