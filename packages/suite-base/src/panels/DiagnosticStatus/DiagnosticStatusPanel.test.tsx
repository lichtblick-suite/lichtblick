/** @vitest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/DiagnosticStatus/constants";
import {
  DiagnosticStatusConfig,
  DiagnosticStatusPanelProps,
} from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import useDiagnostics, {
  UseDiagnosticsResult,
} from "@lichtblick/suite-base/panels/DiagnosticSummary/hooks/useDiagnostics";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import DiagnosticStatusPanel from "./DiagnosticStatusPanel";

vi.mock("@lichtblick/suite-base/panels/DiagnosticSummary/hooks/useDiagnostics");

describe("DiagnosticStatusPanel", () => {
  const mockSaveConfig = vi.fn();
  const mockUseDataSourceInfo = vi.fn(() => ({
    topics: [],
  }));
  const mockUsePanelContext = vi.fn(() => ({
    openSiblingPanel: vi.fn(),
  }));
  const mockUseAvailableDiagnostics = vi.fn();

  vi.mock("@lichtblick/suite-base/PanelAPI", async () => ({
    useDataSourceInfo: mockUseDataSourceInfo,
  }));
  vi.mock("@lichtblick/suite-base/components/PanelContext", async () => ({
    usePanelContext: mockUsePanelContext,
  }));

  vi.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", async () => ({
    usePanelSettingsTreeUpdate: vi.fn(),
  }));

  vi.mock("@lichtblick/suite-base/panels/DiagnosticStatus/hooks/useAvailableDiagnostics", async () => ({
    __esModule: true,
    default: mockUseAvailableDiagnostics,
  }));

  const setup = (configOverride: Partial<DiagnosticStatusConfig> = {}) => {
    const config = DiagnosticsBuilder.statusConfig({
      ...DEFAULT_CONFIG,
      ...configOverride,
    });

    const props: DiagnosticStatusPanelProps = {
      config,
      saveConfig: mockSaveConfig,
    };

    const ui: React.ReactElement = (
      <MockPanelContextProvider>
        <PanelSetup>
          <DiagnosticStatusPanel {...props} />
        </PanelSetup>
      </MockPanelContextProvider>
    );

    return {
      ...render(ui),
      ...props,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the empty state when no diagnostics are available", () => {
    const diagnosticResult: UseDiagnosticsResult = new Map();
    (useDiagnostics as Mock).mockReturnValue(diagnosticResult);

    setup();

    expect(screen.getByText(/No diagnostic node selected/i)).toBeInTheDocument();
  });

  it("should render the empty state when there is a selected display name", () => {
    const diagnosticResult: UseDiagnosticsResult = new Map();
    (useDiagnostics as Mock).mockReturnValue(diagnosticResult);

    const { config } = setup({
      selectedHardwareId: BasicBuilder.string(),
      selectedName: BasicBuilder.string(),
    });

    expect(screen.getByText(/Waiting for diagnostics from/i)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${config.selectedHardwareId}: ${config.selectedName}`, "i")),
    ).toBeInTheDocument();
  });

  it("should render diagnostics when there are filtered diagnostics", () => {
    // Given When
    const hardwareId = BasicBuilder.string();
    const statusMessageName = BasicBuilder.string();
    const statusMessage = DiagnosticsBuilder.statusMessage({
      name: statusMessageName,
    });
    const diagnosticResult: UseDiagnosticsResult = new Map([
      [
        hardwareId,
        new Map([[BasicBuilder.string(), DiagnosticsBuilder.info({ status: statusMessage })]]),
      ],
    ]);
    (useDiagnostics as Mock).mockReturnValue(diagnosticResult);

    setup({
      selectedHardwareId: hardwareId,
      selectedName: statusMessageName,
    });

    // Then
    expect(screen.getByTestId("filtered-diagnostics")).toBeInTheDocument();
  });
});
