/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Ref } from "react";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { PanelContextType } from "@lichtblick/suite-base/components/types";
import { usePanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { PanelConfig } from "@lichtblick/suite-base/types/panels";

import PanelToolbar from "./index";

jest.mock("@lichtblick/suite-base/context/PanelStateContext", () => ({
  usePanelStateStore: jest.fn(),
}));

jest.mock("./PanelToolbarControls", () => {
  // `jest.mock` factories run before the module's own imports are initialized, so `react` must
  // be pulled in here via `jest.requireActual` rather than closing over a top-level import.
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  return {
    PanelToolbarControls: forwardRef(function PanelToolbarControls(
      _props: unknown,
      ref: Ref<HTMLDivElement>,
    ) {
      return <div data-testid="panel-toolbar-controls" ref={ref} />;
    }),
  };
});

const mockUsePanelStateStore = usePanelStateStore as jest.MockedFunction<typeof usePanelStateStore>;

function renderPanelToolbar({
  panelContextOverrides = {},
  propsOverrides = {},
}: {
  panelContextOverrides?: Partial<PanelContextType<PanelConfig>>;
  propsOverrides?: Record<string, unknown>;
} = {}) {
  const panelContext: PanelContextType<PanelConfig> = {
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
        <PanelContext.Provider value={panelContext}>
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
    mockUsePanelStateStore.mockImplementation((selector) =>
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

  it("Given children and floating are both set When rendering Then the title is not rendered and children replace it", () => {
    // Given / When
    renderPanelToolbar({
      propsOverrides: { floating: true, children: <button>Custom control</button> },
    });

    // Then
    expect(screen.queryByText("Test Panel")).not.toBeInTheDocument();
    expect(screen.getByText("Custom control")).toBeInTheDocument();
  });

  it("Given children and floating are both set When rendering Then the children are inside the pointer-enabled floating container alongside the controls", () => {
    // Given / When
    renderPanelToolbar({
      propsOverrides: { floating: true, children: <button>Custom control</button> },
    });

    // Then the custom children and the built-in controls share the same floating container, so
    // both receive pointer events (unlike the header itself, which has pointer-events disabled
    // while floating)
    const customControl = screen.getByText("Custom control");
    const controls = screen.getByTestId("panel-toolbar-controls");
    expect(customControl.parentElement).toBe(controls.parentElement);
    expect(customControl.parentElement?.className).toEqual(
      expect.stringContaining("floatingControls"),
    );
  });
});
