/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { createMuiTheme } from "@lichtblick/theme";

import { AlertIcon } from "./AlertIcon";

const lightPalette = createMuiTheme("light").palette;

function renderAlertIcon(severity: "error" | "warn" | "info") {
  return render(
    <ThemeProvider isDark={false}>
      <AlertIcon severity={severity} />
    </ThemeProvider>,
  );
}

describe("AlertIcon", () => {
  it("renders the error icon with the error palette color", () => {
    // Given / When
    const { container } = renderAlertIcon("error");

    // Then
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("fill", lightPalette.error.main);
  });

  it("renders the warning icon with the warning palette color", () => {
    // Given / When
    const { container } = renderAlertIcon("warn");

    // Then
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("fill", lightPalette.warning.main);
  });

  it("renders the info icon with the info palette color", () => {
    // Given / When
    const { container } = renderAlertIcon("info");

    // Then
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("fill", lightPalette.info.main);
  });

  it("renders nothing for an unknown severity", () => {
    // Given
    const severity = "unknown" as unknown as "error";

    // When
    const { container } = renderAlertIcon(severity);

    // Then
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});
