/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { usePanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import PanelToolbar from "./index";

jest.mock("@lichtblick/suite-base/context/PanelStateContext", () => ({
  usePanelStateStore: jest.fn(),
}));

jest.mock("./PanelToolbarControls", () => ({
  PanelToolbarControls: () => <div data-testid="panel-toolbar-controls" />,
}));

const mockUsePanelStateStore = usePanelStateStore as jest.MockedFunction<typeof usePanelStateStore>;

function renderPanelToolbar({ panelContextOverrides = {}, propsOverrides = {} } = {}) {
  const panelContext = {
    id: "test-panel-id",
    type: "TestPanel",
    title: "Test Panel",
    config: {},
    saveConfig: jest.fn(),
    updatePanelConfigs: jest.fn(),
    openSiblingPanel: jest.fn(),
    replacePanel: jest.fn(),
    enterFullscreen: jest.fn(),
    exitFullscreen: jest.fn(),
    isFullscreen: false,
    setHasFullscreenDescendant: jest.fn(),
    connectToolbarDragHandle: jest.fn(),
    setMessagePathDropConfig: jest.fn(),
    ...panelContextOverrides,
  };

  return {
    ...render(
      <ThemeProvider isDark>
        <PanelContext.Provider value={panelContext as any}>
          <PanelToolbar {...propsOverrides} />
        </PanelContext.Provider>
      </ThemeProvider>,
    ),
    panelContext,
  };
}

describe("PanelToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePanelStateStore.mockImplementation((selector: any) =>
      selector({ defaultTitles: {}, updateDefaultTitle: jest.fn() }),
    );
  });

  it("Given floating is false When rendering Then the controls are not wrapped in a floating container", () => {
    // Given / When
    renderPanelToolbar({ propsOverrides: { floating: false } });

    // Then
    expect(screen.getByTestId("panel-toolbar-controls")).toBeInTheDocument();
    expect(screen.getByTestId("panel-toolbar-controls").parentElement).toHaveAttribute(
      "data-testid",
      "mosaic-drag-handle",
    );
  });

  it("Given floating is true and hovered is false When rendering Then the controls are wrapped without the visible class", () => {
    // Given / When
    renderPanelToolbar({ propsOverrides: { floating: true, hovered: false } });

    // Then
    const controls = screen.getByTestId("panel-toolbar-controls");
    expect(controls.parentElement).not.toBeNull();
    expect(controls.parentElement?.className).toEqual(expect.stringContaining("floatingControls"));
    expect(controls.parentElement?.className).not.toEqual(
      expect.stringContaining("floatingControlsVisible"),
    );
  });

  it("Given floating is true and hovered is true When rendering Then the floating controls are made visible", () => {
    // Given / When
    renderPanelToolbar({ propsOverrides: { floating: true, hovered: true } });

    // Then
    const controls = screen.getByTestId("panel-toolbar-controls");
    expect(controls.parentElement?.className).toEqual(
      expect.stringContaining("floatingControlsVisible"),
    );
  });

  it("Given floating is true When rendering the title Then it uses the floating title styling", () => {
    // Given / When
    renderPanelToolbar({ propsOverrides: { floating: true } });

    // Then
    const title = screen.getByText("Test Panel");
    expect(title.className).toEqual(expect.stringContaining("floatingTitle"));
  });
});
