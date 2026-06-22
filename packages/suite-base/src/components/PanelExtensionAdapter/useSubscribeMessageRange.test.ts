/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { MessageEvent } from "@lichtblick/suite";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import { createMessageRangeIterator } from "./messageRangeIterator";
import { useSubscribeMessageRange } from "./useSubscribeMessageRange";

vi.mock("@lichtblick/suite-base/components/MessagePipeline", async () => ({
  useMessagePipelineGetter: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", async () => ({
  useExtensionCatalog: vi.fn(),
}));

vi.mock("./messageRangeIterator", async () => ({
  createMessageRangeIterator: vi.fn(),
}));

const mockUseMessagePipelineGetter = useMessagePipelineGetter as Mock;
const mockUseExtensionCatalog = useExtensionCatalog as Mock;
const mockCreateMessageRangeIterator = createMessageRangeIterator as Mock;

describe("useSubscribeMessageRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseExtensionCatalog.mockReturnValue([]);
  });

  it("does not call onNewRangeIterator when batch iterator is unavailable", () => {
    // Given
    mockUseMessagePipelineGetter.mockReturnValue(
      vi.fn().mockReturnValue({
        sortedTopics: [],
        getBatchIterator: vi.fn().mockReturnValue(undefined),
      }),
    );
    const onNewRangeIterator = vi.fn().mockResolvedValue(undefined);
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
      vi.fn().mockReturnValue({
        sortedTopics: [],
        getBatchIterator: vi.fn().mockReturnValue(undefined),
      }),
    );
    const onNewRangeIterator = vi.fn().mockResolvedValue(async () => {});
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
    const mockIterable: AsyncIterable<MessageEvent[]> = { [Symbol.asyncIterator]: vi.fn() };
    const mockCancel = vi.fn();
    let cancel!: () => void;
    const mockBatchIterator = { [Symbol.asyncIterator]: vi.fn() };
    const onNewRangeIterator = vi.fn().mockResolvedValue(async () => {});
    mockCreateMessageRangeIterator.mockReturnValue({ iterable: mockIterable, cancel: mockCancel });
    const mockGetBatchIterator = vi.fn().mockReturnValue(mockBatchIterator);
    mockUseMessagePipelineGetter.mockReturnValue(
      vi.fn().mockReturnValue({ sortedTopics: [], getBatchIterator: mockGetBatchIterator }),
    );

    const { result } = renderHook(() => useSubscribeMessageRange());

    // When
    act(() => {
      cancel = result.current({ topic, onNewRangeIterator });
    });

    // Then
    expect(mockGetBatchIterator).toHaveBeenCalledWith(topic);
    expect(onNewRangeIterator).toHaveBeenCalledWith(mockIterable);
    expect(cancel).toBe(mockCancel);
    expect(mockCreateMessageRangeIterator).toHaveBeenCalledWith(
      expect.objectContaining({
        topic,
        rawBatchIterator: mockBatchIterator,
        sortedTopics: [],
      }),
    );
  });
});
