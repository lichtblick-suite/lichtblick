/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import {
  DiagnosticStatusConfig,
  DiagnosticStatusPanelProps,
} from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";

import DiagnosticStatusPanel from "./DiagnosticStatusPanel";

describe("DiagnosticStatusPanel", () => {
  const mockSaveConfig = jest.fn();
  const mockUseDataSourceInfo = jest.fn(() => ({
    topics: [],
  }));
  const mockUsePanelContext = jest.fn(() => ({
    openSiblingPanel: jest.fn(),
  }));
  const mockUseAvailableDiagnostics = jest.fn();
  const mockUseDiagnostics = jest.fn();

  jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
    useDataSourceInfo: mockUseDataSourceInfo,
  }));
  jest.mock("@lichtblick/suite-base/components/PanelContext", () => ({
    usePanelContext: mockUsePanelContext,
  }));

  jest.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", () => ({
    usePanelSettingsTreeUpdate: jest.fn(),
  }));

  jest.mock("@lichtblick/suite-base/panels/DiagnosticSummary/hooks/useDiagnostics", () => ({
    __esModule: true,
    default: mockUseDiagnostics,
  }));

  jest.mock("@lichtblick/suite-base/panels/DiagnosticStatus/hooks/useAvailableDiagnostics", () => ({
    __esModule: true,
    default: mockUseAvailableDiagnostics,
  }));

  const setup = (configOverrides: Partial<DiagnosticStatusConfig> = {}) => {
    const defaultConfig = {
      ...DiagnosticsBuilder.statusConfig(),
      configOverrides,
    };

    const props: DiagnosticStatusPanelProps = {
      config: defaultConfig,
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
    jest.clearAllMocks();
  });

  it("should render the empty state when no diagnostics are available", () => {
    setup({});

    expect(screen.getByText(/No diagnostic node selected/i)).toBeInTheDocument();
  });

  it("should render diagnostics when filteredDiagnostics.length > 0", () => {
    mockUseDiagnostics.mockReturnValue(
      new Map([
        [
          "hardwareId1",
          new Map([
            [
              "diagnostic1",
              {
                status: { name: "Diagnostic 1", level: "OK" },
                stamp: { sec: 1, nsec: 0 },
              },
            ],
          ]),
        ],
      ]),
    );

    mockUseAvailableDiagnostics.mockReturnValue(
      new Map([["hardwareId1", new Set(["Diagnostic 1"])]]),
    );

    setup({ topicToRender: "/diagnostic" });

    expect(screen.getByText(/Diagnostic 1/i)).toBeInTheDocument();
  });
});
