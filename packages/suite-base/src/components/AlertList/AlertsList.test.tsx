/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import { AlertsList } from "@lichtblick/suite-base/components/AlertList/AlertsList";
import MockMessagePipelineProvider from "@lichtblick/suite-base/components/MessagePipeline/MockMessagePipelineProvider";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";
import AlertsContextProvider from "@lichtblick/suite-base/providers/AlertsContextProvider";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

function renderAlertsList(alerts: PlayerAlert[]) {
  return render(
    <ThemeProvider isDark={false}>
      <AlertsContextProvider>
        <MockMessagePipelineProvider alerts={alerts}>
          <AlertsList />
        </MockMessagePipelineProvider>
      </AlertsContextProvider>
    </ThemeProvider>,
  );
}

describe("AlertsList", () => {
  it("shows an empty state when there are no alerts", () => {
    // Given
    // no alerts

    // When
    renderAlertsList([]);

    // Then
    expect(screen.getByText("No alerts found")).toBeInTheDocument();
  });

  it("renders all provided player alerts", () => {
    // Given
    const alerts: PlayerAlert[] = [
      { severity: "error", message: "Error alert" },
      { severity: "warn", message: "Warn alert" },
      { severity: "info", message: "Info alert" },
    ];

    // When
    renderAlertsList(alerts);

    // Then
    expect(screen.getByText("Error alert")).toBeInTheDocument();
    expect(screen.getByText("Warn alert")).toBeInTheDocument();
    expect(screen.getByText("Info alert")).toBeInTheDocument();
  });

  it("dismisses an individual player alert", () => {
    // Given
    const alerts: PlayerAlert[] = [
      { severity: "error", message: "First alert" },
      { severity: "error", message: "Second alert" },
    ];
    renderAlertsList(alerts);

    // When
    const dismissButtons = screen.getAllByLabelText("Dismiss");
    fireEvent.click(dismissButtons[0]!);

    // Then
    expect(screen.queryByText("First alert")).not.toBeInTheDocument();
    expect(screen.getByText("Second alert")).toBeInTheDocument();
  });
});
