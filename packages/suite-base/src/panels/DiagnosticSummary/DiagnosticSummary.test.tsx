/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import DiagnosticSummary from "@lichtblick/suite-base/panels/DiagnosticSummary";
import { DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import useDiagnostics, {
  UseDiagnosticsResult,
} from "@lichtblick/suite-base/panels/DiagnosticSummary/hooks/useDiagnostics";
import {
  DiagnosticSummaryConfig,
  DiagnosticSummaryProps,
} from "@lichtblick/suite-base/panels/DiagnosticSummary/types";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/panels/DiagnosticSummary/hooks/useDiagnostics");

jest.mock("react-virtualized-auto-sizer", () => ({
  __esModule: true,
  default: ({
    children,
  }: {
    children: (size: { height: number; width: number }) => React.JSX.Element;
  }) => children({ height: 500, width: 500 }),
}));

describe("DiagnosticSummary", () => {
  const mockSaveConfig = jest.fn();
  const mockOpenSiblingPanel = jest.fn();

  jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
    useDataSourceInfo: jest.fn(() => ({
      topics: [],
    })),
  }));

  jest.mock("@lichtblick/suite-base/components/PanelContext", () => ({
    usePanelContext: jest.fn(() => ({
      openSiblingPanel: mockOpenSiblingPanel,
    })),
  }));

  jest.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", () => ({
    usePanelSettingsTreeUpdate: jest.fn(),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setup(overrideConfig: Partial<DiagnosticSummaryConfig> = {}) {
    const config: DiagnosticSummaryConfig = DiagnosticsBuilder.summaryConfig({
      ...DEFAULT_CONFIG,
      ...overrideConfig,
    });

    const props: DiagnosticSummaryProps = {
      config,
      saveConfig: mockSaveConfig,
    };

    const ui: React.ReactElement = (
      <div style={{ width: 800, height: 500 }}>
        <PanelSetup>
          <DiagnosticSummary {...props} />
        </PanelSetup>
      </div>
    );
    return {
      ...render(ui),
      ...props,
    };
  }

  it("renders empty state when no diagnostics are available", () => {
    const diagnosticResult: UseDiagnosticsResult = new Map();
    (useDiagnostics as jest.Mock).mockReturnValueOnce(diagnosticResult);

    const { config } = setup();

    expect(screen.getByText(/waiting for messages/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(config.topicToRender, "i"))).toBeInTheDocument();
  });

  it("renders diagnostics and pinned items", () => {
    const hardwareId = BasicBuilder.string();
    const diagnosticId = BasicBuilder.string();
    const diagnosticInfo = DiagnosticsBuilder.info();
    const diagnosticResult: UseDiagnosticsResult = new Map([
      [hardwareId, new Map([[diagnosticId, diagnosticInfo]])],
    ]);
    (useDiagnostics as jest.Mock).mockReturnValue(diagnosticResult);

    setup({
      pinnedIds: [`1|${hardwareId}|${diagnosticId}`],
    });

    expect(screen.getByTestId("diagnostic-summary-node-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("diagnostic-summary-node-row-1")).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(diagnosticInfo.displayName, "i")).length).toBe(2);
  });
});
