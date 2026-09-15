/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";

import { DeltaOverlay, DeltaOverlayProps } from "./DeltaOverlay";
import "@testing-library/jest-dom";

describe("DeltaOverlay", () => {
  function buildProps(overrides: Partial<DeltaOverlayProps> = {}): DeltaOverlayProps {
    return {
      deltaRowLabel: "Delta",
      xColumnLabel: "X-axis",
      yColumnLabel: "Y-axis",
      markerALabel: "P1",
      markerBLabel: "P2",
      xValueA: 1,
      xValueB: 2,
      yValueA: 10,
      yValueB: 20,
      deltaX: 1,
      deltaY: 10,
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

  it("should render the column headers for X-axis and Y-axis", () => {
    // Given
    const props = buildProps();

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByText(props.xColumnLabel)).toBeInTheDocument();
    expect(screen.getByText(props.yColumnLabel)).toBeInTheDocument();
  });

  it("should render colored marker dots when marker colors are provided", () => {
    // Given
    const props = buildProps({
      markerAColor: "#EF833A",
      markerBColor: "#FFC107",
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByTestId("delta-overlay-dot-a")).toBeInTheDocument();
    expect(screen.getByTestId("delta-overlay-dot-b")).toBeInTheDocument();
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

  it("should render placeholders when values are undefined", () => {
    // Given
    const props = buildProps({
      xValueA: undefined,
      xValueB: undefined,
      yValueA: undefined,
      yValueB: undefined,
      deltaX: undefined,
      deltaY: undefined,
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getAllByText("—")).toHaveLength(6);
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

  it("should not render a marker's remove button before that marker is placed", () => {
    // Given
    const props = buildProps({ xValueA: undefined, xValueB: undefined });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.queryByTestId("delta-overlay-remove-marker-a")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delta-overlay-remove-marker-b")).not.toBeInTheDocument();
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
      yValueA: undefined,
      yValueB: undefined,
      deltaX: undefined,
      deltaY: undefined,
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getAllByText("—")).toHaveLength(6);
  });

  it("should render marker A's value once placed while marker B is still a placeholder", () => {
    // Given
    const props = buildProps({
      xValueA: 4.5,
      xValueB: undefined,
      yValueA: 10.2,
      yValueB: undefined,
      deltaX: undefined,
      deltaY: undefined,
      formatXValue: (value) => `${value.toFixed(1)}s`,
      formatYValue: (value) => `${value.toFixed(1)}s`,
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByText("4.5s")).toBeInTheDocument();
    expect(screen.getByText("10.2s")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("should format x values and y values with 6 decimal places by default", () => {
    // Given
    const props = buildProps({
      xValueA: 4.6,
      xValueB: 6.0,
      yValueA: 93.688286,
      yValueB: 13.924775,
      deltaX: 1.4,
      deltaY: 79.763511,
    });

    // When
    render(<DeltaOverlay {...props} />);

    // Then
    expect(screen.getByText("4.600000")).toBeInTheDocument();
    expect(screen.getByText("6.000000")).toBeInTheDocument();
    expect(screen.getByText("1.400000")).toBeInTheDocument();
    expect(screen.getByText("93.688286")).toBeInTheDocument();
    expect(screen.getByText("13.924775")).toBeInTheDocument();
    expect(screen.getByText("79.763511")).toBeInTheDocument();
  });
});
