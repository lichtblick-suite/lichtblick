/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { ChartDatasets } from "@lichtblick/suite-base/components/TimeBasedChart/types";

import useStateTransitionsDeltaMode, {
  UseStateTransitionsDeltaModeProps,
} from "./useStateTransitionsDeltaMode";

describe("useStateTransitionsDeltaMode", () => {
  function buildDatasets(
    pointsByDataset: Array<Array<{ x: number; value: string }>>,
  ): ChartDatasets {
    return pointsByDataset.map((points) => ({
      data: points.map(({ x, value }) => ({ x, y: 0, value })),
    }));
  }

  const setup = (datasets: ChartDatasets = [], resetKey?: string) => {
    const props: UseStateTransitionsDeltaModeProps = { datasets, resetKey };
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
});
