/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";

import {
  DiagnosticInfo,
  DiagnosticStatusProps,
} from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import DiagnosticTable from "./DiagnosticTable";

type Setup = {
  infoOverride?: Partial<DiagnosticInfo>;
};

describe("DiagnosticTable", () => {
  const mockOnChangeSplitFraction = jest.fn();
  const mockOpenSiblingPanel = jest.fn();

  function setup({ infoOverride }: Setup = {}) {
    const info = {
      ...DiagnosticsBuilder.info(),
      ...infoOverride,
    };
    const defaultProps: DiagnosticStatusProps = {
      info,
      numericPrecision: 2,
      onChangeSplitFraction: mockOnChangeSplitFraction,
      openSiblingPanel: mockOpenSiblingPanel,
      splitFraction: 0.5,
      topicToRender: BasicBuilder.string(),
    };

    return {
      ...render(<DiagnosticTable {...defaultProps} />),
      ...defaultProps,
    };
  }

  it("should render the display name and message", () => {
    // Given When
    const { info } = setup();

    // Then
    expect(screen.getByText(info.displayName)).toBeTruthy();
    expect(screen.getByText(info.status.message)).toBeTruthy();
  });

  it("should render the resize handle and triggers onChangeSplitFraction on mouse events", () => {
    // Given When
    setup();

    const resizeHandle = screen.getByTestId("DiagnosticTable-resizeHandle");
    expect(resizeHandle).toBeTruthy();

    fireEvent.mouseDown(resizeHandle);
    fireEvent.mouseMove(window, { clientX: 100 });
    fireEvent.mouseUp(window);

    expect(mockOnChangeSplitFraction).toHaveBeenCalled();
  });

  it("should render key-value pairs with numeric precision formatting", () => {
    const { info } = setup();

    expect(screen.getByText(info.status.values[0]!.key)).toBeTruthy();
    expect(screen.getByText(info.status.values[0]!.value)).toBeTruthy();
    expect(screen.getByText(info.status.values[1]!.key)).toBeTruthy();
    expect(screen.getByText(info.status.values[1]!.value)).toBeTruthy();
    expect(screen.getByText(info.status.values[2]!.key)).toBeTruthy();
    expect(screen.getByText(info.status.values[2]!.value)).toBeTruthy();
  });

  it("should render 'Open in Plot panel' and 'Open in State Transitions panel' buttons", () => {
    const values = [
      DiagnosticsBuilder.keyValue({
        key: BasicBuilder.string(),
        value: BasicBuilder.string(),
      }),
      DiagnosticsBuilder.keyValue({
        key: BasicBuilder.string(),
        value: BasicBuilder.float().toString(),
      }),
    ];
    const status = DiagnosticsBuilder.statusMessage({ values });
    setup({
      infoOverride: DiagnosticsBuilder.info({ status }),
    });

    const plotButton = screen.getByTestId("open-plot-button");
    expect(plotButton).toBeTruthy();
    fireEvent.click(plotButton);
    expect(mockOpenSiblingPanel).toHaveBeenCalled();

    const stateTransitionsButton = screen.getByTestId("open-state-transitions-button");
    expect(stateTransitionsButton).toBeTruthy();
    fireEvent.click(stateTransitionsButton);
    expect(mockOpenSiblingPanel).toHaveBeenCalled();
  });
});
