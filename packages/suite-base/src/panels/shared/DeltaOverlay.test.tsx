/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";

import { BasicBuilder } from "@lichtblick/test-builders";

import { DeltaOverlay, DeltaOverlayProps } from "./DeltaOverlay";
import "@testing-library/jest-dom";

describe("DeltaOverlay", () => {
  function buildProps(overrides: Partial<DeltaOverlayProps> = {}): DeltaOverlayProps {
    return {
      deltaRowLabel: "Delta",
      xColumnLabel: "X",
      markerALabel: "P1",
      markerBLabel: "P2",
      xValueA: 1,
      xValueB: 2,
      deltaX: 1,
      seriesLabels: [],
      series: [],
      onRemoveMarkerA: jest.fn(),
      onRemoveMarkerB: jest.fn(),
      onClose: jest.fn(),
      ...overrides,
    };
  }

  it("should render the delta row label and the two marker labels", () => {
    // Given
    const props = buildProps();

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByText(props.deltaRowLabel)).toBeInTheDocument();
    expect(screen.getByText(props.markerALabel)).toBeInTheDocument();
    expect(screen.getByText(props.markerBLabel)).toBeInTheDocument();
  });

  it("should render one column per series with its label", () => {
    // Given
    const seriesLabel = BasicBuilder.string();
    const configIndex = BasicBuilder.number();
    const props = buildProps({
      seriesLabels: [{ configIndex, label: seriesLabel, color: "#ff0000" }],
      series: [{ configIndex, valueAtA: 1, valueAtB: 2, delta: 1 }],
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByText(seriesLabel)).toBeInTheDocument();
  });

  it("should label the marker removal buttons distinctly", () => {
    // Given
    const props = buildProps();

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByTestId("delta-overlay-remove-marker-a")).toHaveAccessibleName(
      "Remove marker A",
    );
    expect(screen.getByTestId("delta-overlay-remove-marker-b")).toHaveAccessibleName(
      "Remove marker B",
    );
  });

  it("should render a placeholder when a series has no computed result", () => {
    // Given
    const props = buildProps({
      seriesLabels: [
        {
          configIndex: BasicBuilder.number(),
          label: BasicBuilder.string(),
          color: "#ff0000",
        },
      ],
      series: [],
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("should call onRemoveMarkerA when the marker A remove button is clicked", () => {
    // Given
    const onRemoveMarkerA = jest.fn();
    const props = buildProps({ onRemoveMarkerA });
    render(<DeltaOverlay {...props} />);

    // When
    fireEvent.click(screen.getByTestId("delta-overlay-remove-marker-a"));

    // Then
    expect(onRemoveMarkerA).toHaveBeenCalledTimes(1);
  });

  it("should call onRemoveMarkerB when the marker B remove button is clicked", () => {
    // Given
    const onRemoveMarkerB = jest.fn();
    const props = buildProps({ onRemoveMarkerB });
    render(<DeltaOverlay {...props} />);

    // When
    fireEvent.click(screen.getByTestId("delta-overlay-remove-marker-b"));

    // Then
    expect(onRemoveMarkerB).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when the close button is clicked", () => {
    // Given
    const onClose = jest.fn();
    const props = buildProps({ onClose });
    render(<DeltaOverlay {...props} />);

    // When
    fireEvent.click(screen.getByTestId("delta-overlay-close"));

    // Then
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should label the close button distinctly from the marker removal buttons", () => {
    // Given
    const props = buildProps();

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByTestId("delta-overlay-close")).toHaveAccessibleName("Close measure mode");
  });

  it("should render placeholders for xValueA, xValueB and deltaX before both markers are placed", () => {
    // Given
    const props = buildProps({
      xValueA: undefined,
      xValueB: undefined,
      deltaX: undefined,
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("should render marker A's value once placed while marker B is still a placeholder", () => {
    // Given
    const props = buildProps({
      xValueA: 4.5,
      xValueB: undefined,
      deltaX: undefined,
      formatXValue: (value) => `${value.toFixed(1)}s`,
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByText("4.5s")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("should format x values using the provided formatXValue function", () => {
    // Given
    const props = buildProps({
      xValueA: 1.23456,
      xValueB: 7.891011,
      deltaX: 6.656451,
      formatXValue: (value) => `${value.toFixed(1)}s`,
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.getByText("7.9s")).toBeInTheDocument();
    expect(screen.getByText("6.7s")).toBeInTheDocument();
  });
});
