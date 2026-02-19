/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";
import { enqueueSnackbar } from "notistack";

import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { useAppParameters } from "@lichtblick/suite-base/context/AppParametersContext";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { parseTimestampStr } from "@lichtblick/suite-base/util/parseMultipleTimes";

import useSeekTimeFromCLI from "./useSeekTimeFromCLI";

jest.mock("notistack", () => ({
  enqueueSnackbar: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/components/MessagePipeline");
jest.mock("@lichtblick/suite-base/context/AppParametersContext");
jest.mock("@lichtblick/suite-base/util/parseMultipleTimes");

describe("useSeekTimeFromCLI", () => {
  const mockSeekPlayback = jest.fn();
  const mockUseMessagePipelineGetter = useMessagePipelineGetter as jest.Mock;
  const mockUseAppParameters = useAppParameters as jest.Mock;
  const mockParseTimestampStr = parseTimestampStr as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMessagePipelineGetter.mockReturnValue(() => ({
      playerState: { presence: PlayerPresence.PRESENT },
      seekPlayback: mockSeekPlayback,
    }));
    mockUseAppParameters.mockReturnValue({ time: "00:01:00" });
    mockParseTimestampStr.mockReturnValue(60000); // 1 minute in milliseconds
    jest.mock("notistack", () => ({
      enqueueSnackbar: jest.fn(),
    }));
  });

  it("should seek playback when time and seekPlayback are defined and player is present", () => {
    renderHook(() => {
      useSeekTimeFromCLI();
    });

    expect(mockParseTimestampStr).toHaveBeenCalledWith("00:01:00");
    expect(mockSeekPlayback).toHaveBeenCalledWith(60000);
  });

  it("should not seek playback if time is not defined", () => {
    mockUseAppParameters.mockReturnValue({ time: undefined });

    renderHook(() => {
      useSeekTimeFromCLI();
    });

    expect(mockParseTimestampStr).not.toHaveBeenCalled();
    expect(mockSeekPlayback).not.toHaveBeenCalled();
  });

  it("should not seek playback if seekPlayback is not defined", () => {
    mockUseMessagePipelineGetter.mockReturnValue(() => ({
      playerState: { presence: PlayerPresence.PRESENT },
      seekPlayback: undefined,
    }));

    renderHook(() => {
      useSeekTimeFromCLI();
    });

    expect(mockParseTimestampStr).not.toHaveBeenCalled();
    expect(mockSeekPlayback).not.toHaveBeenCalled();
  });

  it("should not seek playback if player is not present", () => {
    mockUseMessagePipelineGetter.mockReturnValue(() => ({
      playerState: { presence: PlayerPresence.NOT_PRESENT },
      seekPlayback: mockSeekPlayback,
    }));

    renderHook(() => {
      useSeekTimeFromCLI();
    });

    expect(mockParseTimestampStr).not.toHaveBeenCalled();
    expect(mockSeekPlayback).not.toHaveBeenCalled();
  });

  it("should log an error if time parsing fails", () => {
    mockParseTimestampStr.mockReturnValue(undefined);

    renderHook(() => {
      useSeekTimeFromCLI();
    });

    expect(mockSeekPlayback).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      "Invalid time format using 'time' parameter on CLI. Please check and try again.",
      {
        variant: "warning",
      },
    );
  });
});
