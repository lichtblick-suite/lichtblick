/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook, waitFor } from "@testing-library/react";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import { getScenarioFromUrl } from "./registry";
import { Scenario } from "./types";
import { useScenarioBootstrap } from "./useScenarioBootstrap";

jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: {
    getLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipeline: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/PlayerSelectionContext", () => ({
  usePlayerSelection: jest.fn(),
}));

jest.mock("./registry", () => ({
  getScenarioFromUrl: jest.fn(),
}));

function buildScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "scenario-id",
    layout: "empty",
    dataSource: { factoryId: "factory-id" },
    pipeline: "synthetic",
    ...overrides,
  };
}

describe("useScenarioBootstrap", () => {
  let selectSource: jest.Mock;

  beforeEach(() => {
    selectSource = jest.fn();

    (usePlayerSelection as jest.Mock).mockReturnValue({ selectSource });
    (useMessagePipeline as jest.Mock).mockImplementation((selector: (ctx: unknown) => unknown) =>
      selector({
        playerState: { presence: PlayerPresence.PRESENT },
        startPlayback: jest.fn(),
        pausePlayback: jest.fn(),
      }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should select the scenario's data source when a scenario is present", async () => {
    // Given
    const scenario = buildScenario({
      dataSource: { factoryId: "factory-id", params: { url: "http://example.com/file.mcap" } },
    });
    (getScenarioFromUrl as jest.Mock).mockReturnValue(scenario);

    // When
    renderHook(() => {
      useScenarioBootstrap();
    });

    // Then
    await waitFor(() => {
      expect(selectSource).toHaveBeenCalledWith("factory-id", {
        type: "connection",
        params: scenario.dataSource.params,
      });
    });
  });

  it("should not select a data source when no scenario is present", () => {
    // Given
    (getScenarioFromUrl as jest.Mock).mockReturnValue(undefined);

    // When
    renderHook(() => {
      useScenarioBootstrap();
    });

    // Then
    expect(selectSource).not.toHaveBeenCalled();
  });

  describe("autoStart", () => {
    function mockPipeline(ctx: {
      presence: PlayerPresence;
      startPlayback: (() => void) | undefined;
      pausePlayback: (() => void) | undefined;
    }) {
      (useMessagePipeline as jest.Mock).mockImplementation((selector: (ctx: unknown) => unknown) =>
        selector({
          playerState: { presence: ctx.presence },
          startPlayback: ctx.startPlayback,
          pausePlayback: ctx.pausePlayback,
        }),
      );
    }

    it("should start playback once the player is present and startPlayback is available", async () => {
      // Given
      const scenario = buildScenario({ autoStart: true });
      (getScenarioFromUrl as jest.Mock).mockReturnValue(scenario);
      const startPlayback = jest.fn();
      mockPipeline({ presence: PlayerPresence.PRESENT, startPlayback, pausePlayback: jest.fn() });

      // When
      renderHook(() => {
        useScenarioBootstrap();
      });

      // Then
      await waitFor(() => {
        expect(startPlayback).toHaveBeenCalledTimes(1);
      });
    });

    it("should not start playback while the player is not present", () => {
      // Given
      const scenario = buildScenario({ autoStart: true });
      (getScenarioFromUrl as jest.Mock).mockReturnValue(scenario);
      const startPlayback = jest.fn();
      mockPipeline({
        presence: PlayerPresence.INITIALIZING,
        startPlayback,
        pausePlayback: jest.fn(),
      });

      // When
      renderHook(() => {
        useScenarioBootstrap();
      });

      // Then
      expect(startPlayback).not.toHaveBeenCalled();
    });

    it("should not start playback for scenarios without autoStart", () => {
      // Given
      const scenario = buildScenario({ autoStart: undefined });
      (getScenarioFromUrl as jest.Mock).mockReturnValue(scenario);
      const startPlayback = jest.fn();
      mockPipeline({ presence: PlayerPresence.PRESENT, startPlayback, pausePlayback: jest.fn() });

      // When
      renderHook(() => {
        useScenarioBootstrap();
      });

      // Then
      expect(startPlayback).not.toHaveBeenCalled();
    });

    it("should retry on a later render and start playback once startPlayback becomes available, even though presence already reached PRESENT on an earlier render", async () => {
      // Given: presence is PRESENT but the pipeline hasn't recomputed startPlayback yet (the race
      // this hook must tolerate, since MessagePipeline's `store.ts` only rebinds
      // startPlayback/pausePlayback when `capabilities` changes vs. `lastCapabilities`, which is
      // not guaranteed to land in the same store update as `presence` turning PRESENT).
      const scenario = buildScenario({ autoStart: true });
      (getScenarioFromUrl as jest.Mock).mockReturnValue(scenario);
      const startPlayback = jest.fn();
      mockPipeline({
        presence: PlayerPresence.PRESENT,
        startPlayback: undefined,
        pausePlayback: undefined,
      });

      // When
      const { rerender } = renderHook(() => {
        useScenarioBootstrap();
      });

      // Then: startPlayback isn't callable yet, so nothing should have happened
      expect(startPlayback).not.toHaveBeenCalled();

      // When startPlayback becomes available on a subsequent render, presence still PRESENT
      mockPipeline({ presence: PlayerPresence.PRESENT, startPlayback, pausePlayback: jest.fn() });
      rerender();

      // Then
      await waitFor(() => {
        expect(startPlayback).toHaveBeenCalledTimes(1);
      });
    });

    it("should only start playback once even after further renders once already started", async () => {
      // Given
      const scenario = buildScenario({ autoStart: true });
      (getScenarioFromUrl as jest.Mock).mockReturnValue(scenario);
      const startPlayback = jest.fn();
      mockPipeline({ presence: PlayerPresence.PRESENT, startPlayback, pausePlayback: jest.fn() });

      // When
      const { rerender } = renderHook(() => {
        useScenarioBootstrap();
      });
      await waitFor(() => {
        expect(startPlayback).toHaveBeenCalledTimes(1);
      });
      rerender();
      rerender();

      // Then
      expect(startPlayback).toHaveBeenCalledTimes(1);
    });

    it("should pause playback after durationMs once playback has actually started", async () => {
      // Given
      jest.useFakeTimers();
      const scenario = buildScenario({ autoStart: true, durationMs: 5_000 });
      (getScenarioFromUrl as jest.Mock).mockReturnValue(scenario);
      const startPlayback = jest.fn();
      const pausePlayback = jest.fn();
      mockPipeline({ presence: PlayerPresence.PRESENT, startPlayback: undefined, pausePlayback });

      // When: startPlayback not yet ready, so the durationMs timer must not start either
      const { rerender } = renderHook(() => {
        useScenarioBootstrap();
      });
      jest.advanceTimersByTime(5_000);

      // Then
      expect(pausePlayback).not.toHaveBeenCalled();

      // When startPlayback becomes ready on a later render
      mockPipeline({ presence: PlayerPresence.PRESENT, startPlayback, pausePlayback });
      rerender();
      await waitFor(() => {
        expect(startPlayback).toHaveBeenCalledTimes(1);
      });
      jest.advanceTimersByTime(5_000);

      // Then
      expect(pausePlayback).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });
});
