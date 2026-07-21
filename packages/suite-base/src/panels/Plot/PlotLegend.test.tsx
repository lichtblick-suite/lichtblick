/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import "@testing-library/jest-dom/vitest";
import { userEvent } from "@storybook/testing-library";
import { render, screen } from "@testing-library/react";
import { useMemo } from "react";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import { PlotLegend } from "./PlotLegend";

const defaultProps = {
  showLegend: true,
  saveConfig: vi.fn(),
  sidebarDimension: BasicBuilder.number(),
  paths: [],
};

const getContextValue = () => ({
  type: "foo",
  id: "bar",
  title: "Foo Panel",
  config: {},
  saveConfig: vi.fn(),
  updatePanelConfigs: vi.fn(),
  exitFullscreen: vi.fn(),
  setHasFullscreenDescendant: vi.fn(),
  isFullscreen: false,
  connectToolbarDragHandle: vi.fn(),
  setMessagePathDropConfig: vi.fn(),
  openSiblingPanel: vi.fn(),
  replacePanel: vi.fn(),
  enterFullscreen: vi.fn(),
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const contextValue = useMemo(getContextValue, []);
  return (
    <PanelContext.Provider value={contextValue}>
      <div>{children}</div>
    </PanelContext.Provider>
  );
};

const setup = (overrides = {}) => {
  const props = { ...defaultProps, ...overrides };
  return render(
    <PanelContext.Provider value={getContextValue()}>
      <TestWrapper>
        <PlotLegend
          coordinator={undefined}
          legendDisplay="floating"
          onClickPath={vi.fn()}
          showValues={false}
          {...props}
        />
      </TestWrapper>
    </PanelContext.Provider>,
  );
};

vi.mock("@lichtblick/hooks", async () => ({
  useGuaranteedContext: vi.fn(() => ({
    setState: vi.fn(),
    state: {},
  })),
  useSetState: vi.fn(),
  useContext: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/CurrentLayoutContext", async () => ({
  useCurrentLayoutActions: vi.fn(() => ({
    getCurrentLayoutState: vi.fn(),
    setCurrentLayout: vi.fn(),
  })),
  useSelectedPanels: vi.fn(() => []),
}));

describe("PlotLegend", () => {
  const mockSetSelectedPanelIds = vi.fn();
  const path = BasicBuilder.string();
  const secondPath = BasicBuilder.string();

  beforeEach(() => {
    (useSelectedPanels as Mock).mockReturnValue({
      setSelectedPanelIds: mockSetSelectedPanelIds,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders PlotLegend without crashing", () => {
    setup();
    expect(screen.getByTitle("Add series")).toBeDefined();
  });

  it("toggles legend visibility when IconButton is clicked", async () => {
    const mockSaveConfig = vi.fn();
    const { getByRole } = setup({ showLegend: false, saveConfig: mockSaveConfig });

    await userEvent.setup().click(getByRole("button"));

    expect(mockSaveConfig).toHaveBeenCalledWith({ showLegend: true });
  });

  it("renders paths from props", () => {
    const paths = [
      { value: path, enabled: true },
      { value: secondPath, enabled: true },
    ];
    setup({ paths });

    expect(screen.getByText(path)).toBeDefined();
    expect(screen.getByText(secondPath)).toBeDefined();
  });

  it("calls onClickPath when a path is clicked", async () => {
    const mockOnClickPath = vi.fn();
    const paths = [{ value: path, enabled: true }];

    setup({ paths, onClickPath: mockOnClickPath });

    await userEvent.setup().click(screen.getByText(path));

    expect(mockOnClickPath).toHaveBeenCalledWith(0);
  });
});
