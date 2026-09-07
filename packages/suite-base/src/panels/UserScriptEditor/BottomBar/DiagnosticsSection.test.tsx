/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { DIAGNOSTIC_SEVERITY } from "@lichtblick/suite-base/players/UserScriptPlayer/constants";
import { Diagnostic } from "@lichtblick/suite-base/players/UserScriptPlayer/types";
import UserScriptBuilder from "@lichtblick/suite-base/testing/builders/UserScriptBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import DiagnosticsSection from "./DiagnosticsSection";

function renderDiagnosticsSection(diagnostics: readonly Diagnostic[]) {
  return render(
    <ThemeProvider isDark={false}>
      <DiagnosticsSection diagnostics={diagnostics} />
    </ThemeProvider>,
  );
}

describe("DiagnosticsSection", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should display an empty message when there are no diagnostics", () => {
    // Given
    const diagnostics: readonly Diagnostic[] = [];

    // When
    renderDiagnosticsSection(diagnostics);

    // Then
    expect(screen.getByText("No alerts to display.")).toBeInTheDocument();
  });

  it("should render the message of each diagnostic", () => {
    // Given
    const diagnostics = UserScriptBuilder.diagnostics();

    // When
    renderDiagnosticsSection(diagnostics);

    // Then
    diagnostics.forEach((diagnostic) => {
      expect(screen.getByText(diagnostic.message)).toBeInTheDocument();
    });
  });

  it("should render the source and 1-based error location when line and column are provided", () => {
    // Given
    const diagnostic = UserScriptBuilder.diagnostic({
      source: "Typescript",
      startLineNumber: 4,
      startColumn: 2,
    });

    // When
    renderDiagnosticsSection([diagnostic]);

    // Then
    expect(screen.getByText("Typescript [5,3]")).toBeInTheDocument();
  });

  it("should render the source without a location when line and column are undefined", () => {
    // Given
    const diagnostic: Diagnostic = {
      ...UserScriptBuilder.diagnostic({ source: "Runtime" }),
      startLineNumber: undefined,
      startColumn: undefined,
    };

    // When
    renderDiagnosticsSection([diagnostic]);

    // Then
    expect(screen.getByText("Runtime", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/\[\d+,\d+\]/)).not.toBeInTheDocument();
  });

  it("should render one list item per diagnostic", () => {
    // Given
    const diagnostics = UserScriptBuilder.diagnostics(5);

    // When
    renderDiagnosticsSection(diagnostics);

    // Then
    expect(screen.getAllByRole("listitem")).toHaveLength(diagnostics.length);
  });

  it("should render diagnostics for every known severity level", () => {
    // Given
    const diagnostics = Object.values(DIAGNOSTIC_SEVERITY).map((severity) =>
      UserScriptBuilder.diagnostic({ severity }),
    );

    // When
    renderDiagnosticsSection(diagnostics);

    // Then
    expect(screen.getAllByRole("listitem")).toHaveLength(diagnostics.length);
  });
});
