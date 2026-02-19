/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { Time } from "@lichtblick/rostime";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import MockBroadcastChannel from "@lichtblick/suite-base/util/broadcast/MockBroadcastChannel";

import { useDirectionalSeek } from "./useDirectionalSeek";

type Setup = {
  seek: jest.Mock;
  playUntil: jest.Mock | undefined;
  currentTime: Time | undefined;
};

(global as any).BroadcastChannel = MockBroadcastChannel;

jest.mock("@lichtblick/suite-base/hooks", () => ({
  useAppConfigurationValue: jest.fn(),
}));

describe("useDirectionalSeek", () => {
  const mockSeek = jest.fn();
  const mockPlayUntil: jest.Mock | undefined = jest.fn();

  const mockStartTime = RosTimeBuilder.time();
  const mockEndTime = RosTimeBuilder.time();

  function setup({ seek, playUntil, currentTime }: Setup) {
    const getTimeInfo = () => ({
      startTime: mockStartTime,
      endTime: mockEndTime,
      currentTime,
    });

    const { result } = renderHook(() => useDirectionalSeek({ seek, getTimeInfo, playUntil }));
    return {
      seekForward: result.current.seekForwardAction,
      seekBackward: result.current.seekBackwardAction,
    };
  }

  beforeEach(() => {
    (useAppConfigurationValue as jest.Mock).mockReturnValue([true, jest.fn()]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("seekForwardAction", () => {
    it("should do nothing if there's no current time", () => {
      const { seekForward } = setup({
        seek: mockSeek,
        playUntil: mockPlayUntil,
        currentTime: undefined,
      });

      seekForward();

      expect(mockPlayUntil).not.toHaveBeenCalled();
      expect(mockSeek).not.toHaveBeenCalled();
    });

    it("should call playUnitl with the target time", () => {
      const { seekForward } = setup({
        seek: mockSeek,
        playUntil: mockPlayUntil,
        currentTime: RosTimeBuilder.time(),
      });

      seekForward();

      expect(mockPlayUntil).toHaveBeenCalled();
      expect(mockSeek).not.toHaveBeenCalled();
    });

    it("should call seek with the target time", () => {
      const { seekForward } = setup({
        seek: mockSeek,
        playUntil: undefined,
        currentTime: RosTimeBuilder.time(),
      });

      seekForward();

      expect(mockPlayUntil).not.toHaveBeenCalled();
      expect(mockSeek).toHaveBeenCalled();
    });
  });

  describe("seekBackwardAction", () => {
    it("should do nothing if there's no current time", () => {
      const { seekBackward } = setup({
        seek: mockSeek,
        playUntil: mockPlayUntil,
        currentTime: undefined,
      });

      seekBackward();

      expect(mockPlayUntil).not.toHaveBeenCalled();
      expect(mockSeek).not.toHaveBeenCalled();
    });

    it("should call seek with the target time", () => {
      const { seekBackward } = setup({
        seek: mockSeek,
        playUntil: undefined,
        currentTime: RosTimeBuilder.time(),
      });

      seekBackward();

      expect(mockPlayUntil).not.toHaveBeenCalled();
      expect(mockSeek).toHaveBeenCalled();
    });
  });
});
