/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";

import { MessageEvent } from "@lichtblick/suite";
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
      jest.fn().mockReturnValue({ sortedTopics: [], getBatchIterator: mockGetBatchIterator }),
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
