/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { Time, toSec } from "@lichtblick/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { subtractTimes } from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/userUtils/time";

import useStateTransitionsTime from "./useStateTransitionsTime";

jest.mock("@lichtblick/suite-base/components/MessagePipeline");
jest.mock("@lichtblick/rostime");
jest.mock(
  "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/userUtils/time",
);

describe("useStateTransitionsTime", () => {
  const mockUseMessagePipeline = useMessagePipeline as jest.Mock;
  const mockToSec = toSec as jest.Mock;
  const mockSubtractTimes = subtractTimes as jest.Mock;
  type ActiveData = MessagePipelineContext["playerState"]["activeData"];
  type MockActiveData = Partial<NonNullable<ActiveData>> | undefined;

  const mockActiveData = (activeData: MockActiveData) => {
    const mockContext = {
      playerState: { activeData: activeData as ActiveData },
    } as MessagePipelineContext;
    mockUseMessagePipeline.mockImplementation((selector) => selector(mockContext));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([{}, undefined])(
    "should return undefined values when there is no active data or it is undefined. (testing with %s)",
    (activeDataValue) => {
      mockActiveData(activeDataValue as MockActiveData);

      const { result } = renderHook(() => useStateTransitionsTime());

      expect(result.current.startTime).toBeUndefined();
      expect(result.current.currentTimeSinceStart).toBeUndefined();
      expect(result.current.endTimeSinceStart).toBeUndefined();
    },
  );

  it("should calculate currentTimeSinceStart correctly", () => {
    const startTime: Time = { sec: 1, nsec: 0 };
    const currentTime: Time = { sec: 3, nsec: 0 };

    mockActiveData({ startTime, currentTime });

    mockSubtractTimes.mockReturnValue({ sec: 2, nsec: 0 });
    mockToSec.mockReturnValue(2);

    const { result } = renderHook(() => useStateTransitionsTime());

    expect(result.current.startTime).toEqual(startTime);
    expect(result.current.currentTimeSinceStart).toBe(2);
    expect(result.current.endTimeSinceStart).toBeUndefined();
  });

  it("should calculate endTimeSinceStart correctly", () => {
    const startTime: Time = { sec: 1, nsec: 0 };
    const endTime: Time = { sec: 5, nsec: 0 };

    mockActiveData({ startTime, endTime });

    mockSubtractTimes.mockReturnValue({ sec: 4, nsec: 0 });

    mockToSec.mockReturnValue(4);

    const { result } = renderHook(() => useStateTransitionsTime());

    expect(result.current.startTime).toEqual(startTime);
    expect(result.current.currentTimeSinceStart).toBeUndefined();
    expect(result.current.endTimeSinceStart).toBe(4);
  });

  it("should calculate both currentTimeSinceStart and endTimeSinceStart correctly", () => {
    const startTime: Time = { sec: 1, nsec: 0 };
    const currentTime: Time = { sec: 3, nsec: 0 };
    const endTime: Time = { sec: 5, nsec: 0 };

    mockActiveData({ startTime, currentTime, endTime });

    mockSubtractTimes
      .mockReturnValueOnce({ sec: 2, nsec: 0 })
      .mockReturnValueOnce({ sec: 4, nsec: 0 });

    mockToSec.mockReturnValueOnce(2).mockReturnValueOnce(4);

    const { result } = renderHook(() => useStateTransitionsTime());

    expect(result.current.startTime).toEqual(startTime);
    expect(result.current.currentTimeSinceStart).toBe(2);
    expect(result.current.endTimeSinceStart).toBe(4);
  });
});
