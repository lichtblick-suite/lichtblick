/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";

import { MessageEvent, Time } from "@lichtblick/suite";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import { createMessageRangeIterator } from "./messageRangeIterator";
import { useSubscribeMessageRange } from "./useSubscribeMessageRange";

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipelineGetter: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
}));

jest.mock("./messageRangeIterator", () => ({
  createMessageRangeIterator: jest.fn(),
}));

const mockUseMessagePipelineGetter = useMessagePipelineGetter as jest.Mock;
const mockUseExtensionCatalog = useExtensionCatalog as jest.Mock;
const mockCreateMessageRangeIterator = createMessageRangeIterator as jest.Mock;

describe("useSubscribeMessageRange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseExtensionCatalog.mockReturnValue([]);
  });

  it("does not call onNewRangeIterator when batch iterator is unavailable", () => {
    // Given
    mockUseMessagePipelineGetter.mockReturnValue(
      jest.fn().mockReturnValue({
        sortedTopics: [],
        playerState: { playerId: "player-1" },
        getBatchIterator: jest.fn().mockReturnValue(undefined),
      }),
    );
    const onNewRangeIterator = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSubscribeMessageRange());

    // When
    act(() => {
      result.current({ topic: BasicBuilder.string(), onNewRangeIterator });
    });

    // Then
    expect(onNewRangeIterator).not.toHaveBeenCalled();
  });

  it("returns a callable cancel function when batch iterator is unavailable", () => {
    // Given
    mockUseMessagePipelineGetter.mockReturnValue(
      jest.fn().mockReturnValue({
        sortedTopics: [],
        playerState: { playerId: "player-1" },
        getBatchIterator: jest.fn().mockReturnValue(undefined),
      }),
    );
    const onNewRangeIterator = jest.fn().mockResolvedValue(async () => {});
    const { result } = renderHook(() => useSubscribeMessageRange());
    let cancel!: () => void;

    // When
    act(() => {
      cancel = result.current({ topic: BasicBuilder.string(), onNewRangeIterator });
    });

    // Then
    expect(() => {
      cancel();
    }).not.toThrow();
  });

  it("calls onNewRangeIterator with the iterable when batch iterator is available", () => {
    // Given
    const topic = BasicBuilder.string();
    const mockIterable: AsyncIterable<MessageEvent[]> = { [Symbol.asyncIterator]: jest.fn() };
    const mockCancel = jest.fn();
    let cancel!: () => void;
    const mockBatchIterator = { [Symbol.asyncIterator]: jest.fn() };
    const onNewRangeIterator = jest.fn().mockResolvedValue(async () => {});
    mockCreateMessageRangeIterator.mockReturnValue({ iterable: mockIterable, cancel: mockCancel });
    const mockGetBatchIterator = jest.fn().mockReturnValue(mockBatchIterator);
    mockUseMessagePipelineGetter.mockReturnValue(
      jest.fn().mockReturnValue({
        sortedTopics: [],
        playerState: { playerId: "player-1" },
        getBatchIterator: mockGetBatchIterator,
      }),
    );

    const { result } = renderHook(() => useSubscribeMessageRange());

    // When
    act(() => {
      cancel = result.current({ topic, onNewRangeIterator });
    });

    // Then
    expect(mockGetBatchIterator).toHaveBeenCalledWith(topic, {
      abort: expect.any(AbortSignal),
    });
    expect(onNewRangeIterator).toHaveBeenCalledWith(mockIterable);
    cancel();
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCreateMessageRangeIterator).toHaveBeenCalledWith(
      expect.objectContaining({
        topic,
        rawBatchIterator: mockBatchIterator,
        sortedTopics: [],
        abortController: expect.any(AbortController),
      }),
    );
    // The signal handed to the data source belongs to the controller that cancel() aborts.
    const { abortController } = mockCreateMessageRangeIterator.mock.calls[0]![0];
    expect(mockGetBatchIterator.mock.calls[0]![1].abort).toBe(abortController.signal);
  });

  it.each<{ name: string; start?: Time; end?: Time }>([
    { name: "start and end", start: { sec: 1, nsec: 0 }, end: { sec: 2, nsec: 0 } },
    { name: "only start", start: { sec: 1, nsec: 0 } },
    { name: "only end", end: { sec: 2, nsec: 0 } },
    { name: "equal start and end", start: { sec: 1, nsec: 0 }, end: { sec: 1, nsec: 0 } },
  ])("forwards the range to the data source when given $name", ({ start, end }) => {
    // Given
    const topic = BasicBuilder.string();
    mockCreateMessageRangeIterator.mockReturnValue({
      iterable: { [Symbol.asyncIterator]: jest.fn() },
      cancel: jest.fn(),
    });
    const mockGetBatchIterator = jest.fn().mockReturnValue({ [Symbol.asyncIterator]: jest.fn() });
    mockUseMessagePipelineGetter.mockReturnValue(
      jest.fn().mockReturnValue({
        sortedTopics: [],
        playerState: { playerId: "player-1" },
        getBatchIterator: mockGetBatchIterator,
      }),
    );
    const onNewRangeIterator = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSubscribeMessageRange());

    // When
    act(() => {
      result.current({ topic, start, end, onNewRangeIterator });
    });

    // Then
    expect(mockGetBatchIterator).toHaveBeenCalledWith(topic, {
      start,
      end,
      abort: expect.any(AbortSignal),
    });
  });

  it("delivers an empty iterable without reading the data source when start is after end", async () => {
    // Given
    const mockGetBatchIterator = jest.fn();
    mockUseMessagePipelineGetter.mockReturnValue(
      jest.fn().mockReturnValue({
        sortedTopics: [],
        playerState: { playerId: "player-1" },
        getBatchIterator: mockGetBatchIterator,
      }),
    );
    const batches: unknown[] = [];
    const onNewRangeIterator = jest.fn(async (iterable: AsyncIterable<unknown>) => {
      for await (const batch of iterable) {
        batches.push(batch);
      }
    });
    const { result } = renderHook(() => useSubscribeMessageRange());

    // When
    act(() => {
      result.current({
        topic: BasicBuilder.string(),
        start: { sec: 2, nsec: 0 },
        end: { sec: 1, nsec: 0 },
        onNewRangeIterator,
      });
    });
    await act(async () => undefined);

    // Then
    expect(mockGetBatchIterator).not.toHaveBeenCalled();
    expect(mockCreateMessageRangeIterator).not.toHaveBeenCalled();
    expect(onNewRangeIterator).toHaveBeenCalledTimes(1);
    expect(batches).toEqual([]);
  });
  describe("stale generations", () => {
    function setup(playerIds: string[]) {
      const cancels: jest.Mock[] = [];
      mockCreateMessageRangeIterator.mockImplementation(() => {
        const cancel = jest.fn();
        cancels.push(cancel);
        return { iterable: { [Symbol.asyncIterator]: jest.fn() }, cancel };
      });
      const getContext = jest.fn();
      for (const playerId of playerIds) {
        getContext.mockReturnValueOnce({
          sortedTopics: [],
          playerState: { playerId },
          getBatchIterator: jest.fn().mockReturnValue({ [Symbol.asyncIterator]: jest.fn() }),
        });
      }
      mockUseMessagePipelineGetter.mockReturnValue(getContext);
      const hook = renderHook(() => useSubscribeMessageRange());
      const subscribe = () =>
        hook.result.current({
          topic: BasicBuilder.string(),
          onNewRangeIterator: jest.fn(async () => {
            await new Promise<void>(() => {});
          }),
        });
      return { hook, subscribe, cancels };
    }

    it("cancels the open subscriptions of the previous data source", () => {
      // Given
      const { subscribe, cancels } = setup(["player-1", "player-1", "player-2"]);
      subscribe();
      subscribe();

      // When
      subscribe();

      // Then
      expect(cancels[0]).toHaveBeenCalledTimes(1);
      expect(cancels[1]).toHaveBeenCalledTimes(1);
      expect(cancels[2]).not.toHaveBeenCalled();
    });

    it("keeps subscriptions opened while the player was initializing", () => {
      // Given
      const { subscribe, cancels } = setup(["", "player-1"]);
      subscribe();

      // When
      subscribe();

      // Then
      expect(cancels[0]).not.toHaveBeenCalled();
      expect(cancels[1]).not.toHaveBeenCalled();
    });

    it("cancels open subscriptions on unmount, but not ones already cancelled", () => {
      // Given
      const { hook, subscribe, cancels } = setup(["player-1", "player-1"]);
      const unsubscribeFirst = subscribe();
      subscribe();
      unsubscribeFirst();

      // When
      hook.unmount();

      // Then
      expect(cancels[0]).toHaveBeenCalledTimes(1);
      expect(cancels[1]).toHaveBeenCalledTimes(1);
    });
  });
});
