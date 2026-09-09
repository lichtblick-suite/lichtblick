/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { ChartDatasets } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import useDeltaMarkerSync from "@lichtblick/suite-base/panels/shared/useDeltaMarkerSync";
import { BasicBuilder } from "@lichtblick/test-builders";

import useStateTransitionsDeltaMode, {
  UseStateTransitionsDeltaModeProps,
} from "./useStateTransitionsDeltaMode";

jest.mock("@lichtblick/suite-base/panels/shared/useDeltaMarkerSync");

describe("useStateTransitionsDeltaMode", () => {
  function buildDatasets(
    pointsByDataset: Array<Array<{ x: number; value: string }>>,
  ): ChartDatasets {
    return pointsByDataset.map((points) => ({
      data: points.map(({ x, value }) => ({ x, y: 0, value })),
    }));
  }

  beforeEach(() => {
    (useDeltaMarkerSync as jest.Mock).mockReturnValue(undefined);
  });

  const setup = (
    datasets: ChartDatasets = [],
    resetKey?: string,
    overrides: { subscriberId?: string; syncEnabled?: boolean } = {},
  ) => {
    const props: UseStateTransitionsDeltaModeProps = {
      datasets,
      resetKey,
      subscriberId: overrides.subscriberId ?? BasicBuilder.string(),
      syncEnabled: overrides.syncEnabled ?? false,
    };
    return {
      ...renderHook(
        (hookProps: UseStateTransitionsDeltaModeProps) =>
          useStateTransitionsDeltaMode(hookProps),
        { initialProps: props },
      ),
      props,
    };
  };

  it("should start inactive with no markers", () => {
    // Given / When
    const { result } = setup();

    // Then
    expect(result.current.active).toBe(false);
    expect(result.current.markerA).toBeUndefined();
    expect(result.current.markerB).toBeUndefined();
  });

  it("should toggle active on and off, clearing markers", () => {
    // Given
    const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
    const { result } = setup(datasets);

    // When
    act(() => {
      result.current.toggleActive();
    });

    // Then
    expect(result.current.active).toBe(true);

    // When
    act(() => {
      result.current.handleChartClick(1);
    });

    // Then
    expect(result.current.markerA).toBeDefined();

    // When
    act(() => {
      result.current.toggleActive();
    });

    // Then
    expect(result.current.active).toBe(false);
    expect(result.current.markerA).toBeUndefined();
  });

  it("should not place a marker while inactive", () => {
    // Given
    const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
    const { result } = setup(datasets);

    // When
    act(() => {
      result.current.handleChartClick(1);
    });

    // Then
    expect(result.current.markerA).toBeUndefined();
  });

  it("should place marker A on the first click with the state per path", () => {
    // Given
    const datasets = buildDatasets([
      [{ x: 1, value: "IDLE" }],
      [{ x: 1, value: "RUNNING" }],
    ]);
    const { result } = setup(datasets);

    // When
    act(() => {
      result.current.toggleActive();
    });
    act(() => {
      result.current.handleChartClick(1);
    });

    // Then
    expect(result.current.markerA).toEqual({
      xValue: 1,
      seriesValues: [
        { configIndex: 0, value: "IDLE" },
        { configIndex: 1, value: "RUNNING" },
      ],
    });
    expect(result.current.markerB).toBeUndefined();
  });

  it("should place marker B on the second click, keeping marker A", () => {
    // Given
    const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
    const { result } = setup(datasets);
    act(() => {
      result.current.toggleActive();
    });
    act(() => {
      result.current.handleChartClick(1);
    });
    const markerA = result.current.markerA;

    // When
    act(() => {
      result.current.handleChartClick(5);
    });

    // Then
    expect(result.current.markerA).toEqual(markerA);
    expect(result.current.markerB).toBeDefined();
  });

  it("should reset to a fresh marker A on the third click", () => {
    // Given
    const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
    const { result } = setup(datasets);
    act(() => {
      result.current.toggleActive();
    });
    act(() => {
      result.current.handleChartClick(1);
    });
    act(() => {
      result.current.handleChartClick(5);
    });

    // When
    act(() => {
      result.current.handleChartClick(9);
    });

    // Then
    expect(result.current.markerB).toBeUndefined();
    expect(result.current.markerA).toEqual({
      xValue: 9,
      seriesValues: [{ configIndex: 0, value: "IDLE" }],
    });
  });

  it("should skip a path with no state at the clicked time", () => {
    // Given
    const datasets = buildDatasets([
      [{ x: 5, value: "IDLE" }],
      [{ x: 1, value: "RUNNING" }],
    ]);
    const { result } = setup(datasets);
    act(() => {
      result.current.toggleActive();
    });

    // When
    act(() => {
      result.current.handleChartClick(2);
    });

    // Then
    expect(result.current.markerA?.seriesValues).toEqual([
      { configIndex: 1, value: "RUNNING" },
    ]);
  });

  it("should remove marker A and marker B independently", () => {
    // Given
    const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
    const { result } = setup(datasets);
    act(() => {
      result.current.toggleActive();
    });
    act(() => {
      result.current.handleChartClick(1);
    });
    act(() => {
      result.current.handleChartClick(5);
    });

    // When
    act(() => {
      result.current.removeMarkerA();
    });

    // Then
    expect(result.current.markerA).toBeUndefined();
    expect(result.current.markerB).toBeDefined();

    // When
    act(() => {
      result.current.removeMarkerB();
    });

    // Then
    expect(result.current.markerB).toBeUndefined();
  });

  it("should clear markers but keep the mode active when resetKey changes", () => {
    // Given
    const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
    const { result, rerender, props } = setup(datasets, "a");
    act(() => {
      result.current.toggleActive();
    });
    act(() => {
      result.current.handleChartClick(1);
    });
    expect(result.current.markerA).toBeDefined();

    // When
    rerender({ ...props, resetKey: "b" });

    // Then
    expect(result.current.active).toBe(true);
    expect(result.current.markerA).toBeUndefined();
  });

  it("should keep markers when resetKey stays the same across rerenders", () => {
    // Given
    const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
    const { result, rerender, props } = setup(datasets, "a");
    act(() => {
      result.current.toggleActive();
    });
    act(() => {
      result.current.handleChartClick(1);
    });
    expect(result.current.markerA).toBeDefined();

    // When
    rerender({ ...props, resetKey: "a" });

    // Then
    expect(result.current.markerA).toBeDefined();
  });

  describe("remote marker sync", () => {
    function getOnRemoteMarkers(): (
      markerAXValue: number | undefined,
      markerBXValue: number | undefined,
    ) => void {
      const call = (useDeltaMarkerSync as jest.Mock).mock.calls.at(-1)[0];
      return call.onRemoteMarkers;
    }

    it("passes subscriberId through, gating enabled on active", () => {
      // Given / When
      const subscriberId = BasicBuilder.string();
      setup([], undefined, { subscriberId, syncEnabled: true });

      // Then
      expect(useDeltaMarkerSync).toHaveBeenCalledWith(
        expect.objectContaining({ subscriberId, enabled: false }),
      );
    });

    it("enables sync only once the mode is active", () => {
      // Given
      const { result } = setup([], undefined, { syncEnabled: true });

      // When
      act(() => {
        result.current.toggleActive();
      });

      // Then
      expect(useDeltaMarkerSync).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    });

    it("places marker A from a remote x value using this panel's own datasets", () => {
      // Given
      const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
      const { result } = setup(datasets, undefined, { syncEnabled: true });

      // When
      act(() => {
        getOnRemoteMarkers()(1, undefined);
      });

      // Then
      expect(result.current.markerA).toEqual({
        xValue: 1,
        seriesValues: [{ configIndex: 0, value: "IDLE" }],
      });
    });

    it("removes marker B when the remote value is cleared", () => {
      // Given
      const datasets = buildDatasets([[{ x: 1, value: "IDLE" }]]);
      const { result } = setup(datasets, undefined, { syncEnabled: true });
      act(() => {
        result.current.toggleActive();
      });
      act(() => {
        result.current.handleChartClick(1);
      });
      act(() => {
        result.current.handleChartClick(5);
      });
      expect(result.current.markerB).toBeDefined();

      // When
      act(() => {
        getOnRemoteMarkers()(1, undefined);
      });

      // Then
      expect(result.current.markerB).toBeUndefined();
    });

    it("commits a remote reset (new A, cleared B) atomically instead of a stale intermediate A", () => {
      // Given: locally both markers are set (mirrors this panel already showing P1/P2).
      const datasets = buildDatasets([[{ x: 1, value: "IDLE" }, { x: 9, value: "RUNNING" }]]);
      const { result } = setup(datasets, undefined, { syncEnabled: true });
      act(() => {
        result.current.toggleActive();
      });
      act(() => {
        result.current.handleChartClick(1);
      });
      act(() => {
        result.current.handleChartClick(9);
      });
      const staleMarkerA = result.current.markerA;
      expect(result.current.markerB).toBeDefined();

      // When: a combined remote update arrives - a new A and a cleared B in the same call, like
      // a wraparound reset broadcasts it.
      act(() => {
        getOnRemoteMarkers()(9, undefined);
      });

      // Then: marker A reflects the fresh value directly and marker B stays cleared - never a
      // transient render with the old marker A and no marker B.
      expect(result.current.markerA).toEqual({
        xValue: 9,
        seriesValues: [{ configIndex: 0, value: "RUNNING" }],
      });
      expect(result.current.markerA).not.toEqual(staleMarkerA);
      expect(result.current.markerB).toBeUndefined();
    });
  });
});
