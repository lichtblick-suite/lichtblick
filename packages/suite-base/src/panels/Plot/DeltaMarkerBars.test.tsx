/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";

import { DeltaMarkerBarsProps, Scale, YScale } from "@lichtblick/suite-base/panels/Plot/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import { DeltaMarkerBars } from "./DeltaMarkerBars";
import "@testing-library/jest-dom";

describe("DeltaMarkerBars", () => {
  let mockCoordinator: any;

  const setup = (propsOverride: Partial<DeltaMarkerBarsProps> = {}) => {
    const props: DeltaMarkerBarsProps = {
      coordinator: mockCoordinator,
      colorsByDatasetIndex: {},
      labelsByDatasetIndex: {},
      deltaRowLabel: "Delta",
      xColumnLabel: "Time",
      markerALabel: "P1",
      markerBLabel: "P2",
      onRemoveMarkerA: jest.fn(),
      onRemoveMarkerB: jest.fn(),
      ...propsOverride,
    };
    return { ...render(<DeltaMarkerBars {...props} />), props };
  };

  beforeEach(() => {
    mockCoordinator = { on: jest.fn(), off: jest.fn() };
  });

  it("renders nothing without a coordinator", () => {
    // Given / When
    setup({ coordinator: undefined });

    // Then
    expect(screen.queryByTestId("delta-marker-bar-a")).not.toBeInTheDocument();
  });

  it("subscribes to xScaleChanged on mount and unsubscribes on unmount", () => {
    // Given
    const { unmount } = setup();

    // Then
    expect(mockCoordinator.on).toHaveBeenCalledWith("xScaleChanged", expect.any(Function));

    // When
    unmount();

    // Then
    expect(mockCoordinator.off).toHaveBeenCalledWith("xScaleChanged", expect.any(Function));
  });

  it("renders both marker bars once a coordinator is present", () => {
    // Given / When
    setup();

    // Then
    expect(screen.getByTestId("delta-marker-bar-a")).toBeInTheDocument();
    expect(screen.getByTestId("delta-marker-bar-b")).toBeInTheDocument();
  });

  it("does not render the delta overlay when only marker A is set", () => {
    // Given / When
    setup({ markerA: { xValue: 1, seriesValues: [] } });

    // Then
    expect(screen.queryByTestId("delta-overlay")).not.toBeInTheDocument();
  });

  it("renders the delta overlay with the computed delta once both markers are set", () => {
    // Given
    const configIndex = BasicBuilder.number();
    const label = BasicBuilder.string();

    // When
    setup({
      markerA: { xValue: 1, seriesValues: [{ configIndex, value: 5 }] },
      markerB: { xValue: 4, seriesValues: [{ configIndex, value: 11 }] },
      labelsByDatasetIndex: { [configIndex]: label },
      colorsByDatasetIndex: { [configIndex]: "#ff0000" },
    });

    // Then
    expect(screen.getByTestId("delta-overlay")).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("forwards onRemoveMarkerA/onRemoveMarkerB to the overlay buttons", () => {
    // Given
    const onRemoveMarkerA = jest.fn();
    const onRemoveMarkerB = jest.fn();
    setup({
      markerA: { xValue: 1, seriesValues: [] },
      markerB: { xValue: 4, seriesValues: [] },
      onRemoveMarkerA,
      onRemoveMarkerB,
    });

    // When
    fireEvent.click(screen.getByTestId("delta-overlay-remove-marker-a"));
    fireEvent.click(screen.getByTestId("delta-overlay-remove-marker-b"));

    // Then
    expect(onRemoveMarkerA).toHaveBeenCalledTimes(1);
    expect(onRemoveMarkerB).toHaveBeenCalledTimes(1);
  });

  it("subscribes to yScaleChanged on mount and unsubscribes on unmount", () => {
    // Given
    const { unmount } = setup();

    // Then
    expect(mockCoordinator.on).toHaveBeenCalledWith("yScaleChanged", expect.any(Function));

    // When
    unmount();

    // Then
    expect(mockCoordinator.off).toHaveBeenCalledWith("yScaleChanged", expect.any(Function));
  });

  it("hides the horizontal bar, point and label when the marker has no numeric series value", () => {
    // Given / When
    setup({ markerA: { xValue: 1, seriesValues: [] } });

    // Then
    expect(screen.getByTestId("delta-marker-horizontal-bar-a")).not.toBeVisible();
    expect(screen.getByTestId("delta-marker-point-a")).not.toBeVisible();
    expect(screen.getByTestId("delta-marker-label-a")).not.toBeVisible();
  });

  function triggerXScaleChanged(scale: Scale): void {
    const call = mockCoordinator.on.mock.calls.find(([name]: [string]) => name === "xScaleChanged");
    call[1](scale);
  }

  function triggerYScaleChanged(scale: YScale): void {
    const call = mockCoordinator.on.mock.calls.find(([name]: [string]) => name === "yScaleChanged");
    call[1](scale);
  }

  it("positions and labels the on-chart marker once both scales are known", () => {
    // Given
    const configIndex = BasicBuilder.number();
    setup({
      markerA: { xValue: 5, seriesValues: [{ configIndex, value: 50 }] },
      colorsByDatasetIndex: { [configIndex]: "#4e98e2" },
    });

    // When
    triggerXScaleChanged({ min: 0, max: 10, left: 0, right: 100 });
    triggerYScaleChanged({ min: 0, max: 100, top: 0, bottom: 200 });

    // Then
    expect(screen.getByTestId("delta-marker-horizontal-bar-a")).toBeVisible();
    expect(screen.getByTestId("delta-marker-point-a")).toBeVisible();
    expect(screen.getByTestId("delta-marker-label-a")).toHaveTextContent("P1");
  });
});
