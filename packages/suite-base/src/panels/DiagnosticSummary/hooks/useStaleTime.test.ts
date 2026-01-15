/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import {
  useMessagePipelineGetter,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import useStaleTime from "./useStaleTime";

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipelineGetter: jest.fn(),
  useMessagePipeline: jest.fn(),
}));

describe("useStaleTime", () => {
  const mockUseMessagePipelineGetter = useMessagePipelineGetter as jest.Mock;
  const mockUseMessagePipeline = useMessagePipeline as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return undefined when currentTime is undefined", () => {
    // Given
    mockUseMessagePipelineGetter.mockReturnValue(() => ({
      playerState: { activeData: { currentTime: undefined } },
    }));

    // When
    const { result } = renderHook(() => useStaleTime(10));

    // Then
    expect(result.current).toBeUndefined();
  });

  it("should return a stale time when currentTime is defined", () => {
    // Given
    const currentTime = RosTimeBuilder.time();
    mockUseMessagePipelineGetter.mockReturnValue(() => ({
      playerState: { activeData: { currentTime } },
    }));
    const secondsUntilStale = BasicBuilder.number({ min: 1, max: currentTime.sec });

    // When
    const { result } = renderHook(() => useStaleTime(secondsUntilStale));

    // Then
    expect(result.current).toEqual({
      sec: currentTime.sec - secondsUntilStale,
      nsec: currentTime.nsec,
    });
  });

  it("should update stale time at the specified interval", () => {
    // Given
    jest.useFakeTimers();
    let currentTime = RosTimeBuilder.time();
    mockUseMessagePipelineGetter.mockReturnValue(() => ({
      playerState: { activeData: { currentTime } },
    }));

    const secondsUntilStale = BasicBuilder.number({ min: 1, max: currentTime.sec });
    const updateIntervalMillis = BasicBuilder.number({ min: 1 });
    const { result } = renderHook(() => useStaleTime(secondsUntilStale, updateIntervalMillis));

    // When
    act(() => {
      currentTime = RosTimeBuilder.time({ sec: currentTime.sec + 1, nsec: currentTime.nsec });
      jest.advanceTimersByTime(updateIntervalMillis);
    });

    // Then
    expect(result.current).toEqual({
      sec: currentTime.sec - secondsUntilStale,
      nsec: currentTime.nsec,
    });

    jest.useRealTimers();
  });

  it("should recalculate stale time when lastSeekTime changes", () => {
    // Given
    const currentTime = RosTimeBuilder.time({ sec: 100, nsec: 0 });
    const lastSeekTime = RosTimeBuilder.time({ sec: 90, nsec: 0 });
    mockUseMessagePipelineGetter.mockReturnValue(() => ({
      playerState: { activeData: { currentTime } },
    }));
    mockUseMessagePipeline.mockReturnValue(lastSeekTime);

    const { result, rerender } = renderHook(() => useStaleTime(10));

    // When
    act(() => {
      mockUseMessagePipeline.mockReturnValue({ sec: 95, nsec: 0 });
      rerender();
    });

    // Then
    expect(result.current).toEqual(lastSeekTime);
  });

  it("should return undefined when secondsUntilStale is less than 1", () => {
    // Given
    const currentTime = RosTimeBuilder.time();
    mockUseMessagePipelineGetter.mockReturnValue(() => ({
      playerState: { activeData: { currentTime } },
    }));

    // When
    const { result } = renderHook(() => useStaleTime(0.5));

    // Then
    expect(result.current).toBeUndefined();
  });
});
