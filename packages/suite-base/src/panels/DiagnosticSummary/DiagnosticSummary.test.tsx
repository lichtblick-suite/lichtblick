/** @vitest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import "@testing-library/jest-dom/vitest";
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

vi.mock("@lichtblick/suite-base/panels/DiagnosticSummary/hooks/useDiagnostics");

vi.mock("react-virtualized-auto-sizer", async () => ({
  __esModule: true,
  default: ({
    children,
  }: {
    children: (size: { height: number; width: number }) => React.JSX.Element;
  }) => children({ height: 500, width: 500 }),
}));

describe("DiagnosticSummary", () => {
  const mockSaveConfig = vi.fn();
  const mockOpenSiblingPanel = vi.fn();

  vi.mock("@lichtblick/suite-base/PanelAPI", async () => ({
    useDataSourceInfo: vi.fn(() => ({
      topics: [],
    })),
  }));

  vi.mock("@lichtblick/suite-base/components/PanelContext", async () => ({
    usePanelContext: vi.fn(() => ({
      openSiblingPanel: mockOpenSiblingPanel,
    })),
  }));

  vi.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", async () => ({
    usePanelSettingsTreeUpdate: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
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
    (useDiagnostics as Mock).mockReturnValueOnce(diagnosticResult);

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
    (useDiagnostics as Mock).mockReturnValue(diagnosticResult);

    setup({
      pinnedIds: [`1|${hardwareId}|${diagnosticId}`],
    });

    expect(screen.getByTestId("diagnostic-summary-node-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("diagnostic-summary-node-row-1")).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(diagnosticInfo.displayName, "i")).length).toBe(2);
  });
});
