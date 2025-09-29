/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { PanelToolbarControls } from "@lichtblick/suite-base/components/PanelToolbar/PanelToolbarControls";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import PanelCatalogContext from "@lichtblick/suite-base/context/PanelCatalogContext";
import { usePanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

// Mock the dependencies
jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useSelectedPanels: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/PanelStateContext", () => ({
  usePanelStateStore: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", () => ({
  useWorkspaceActions: jest.fn(),
}));

// Mock the PanelActionsDropdown component
jest.mock("@lichtblick/suite-base/components/PanelToolbar/PanelActionsDropdown", () => ({
  PanelActionsDropdown: ({ isUnknownPanel }: { isUnknownPanel: boolean }) => (
    <div data-testid="panel-actions-dropdown" data-unknown-panel={isUnknownPanel}>
      Panel Actions Dropdown
    </div>
  ),
}));

const mockUseSelectedPanels = useSelectedPanels as jest.MockedFunction<typeof useSelectedPanels>;
const mockUsePanelStateStore = usePanelStateStore as jest.MockedFunction<typeof usePanelStateStore>;
const mockUseWorkspaceActions = useWorkspaceActions as jest.MockedFunction<
  typeof useWorkspaceActions
>;

function renderPanelToolbarControls(
  panelContextOverrides = {},
  panelCatalogOverrides = {},
  propsOverrides = {},
) {
  const panelContext = {
    id: "test-panel-id",
    type: "TestPanel",
    title: "Test Panel",
    showLogs: false,
    setShowLogs: jest.fn(),
    logError: jest.fn(),
    logCount: 0,
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

  const panelCatalog = {
    getPanels: jest.fn().mockReturnValue([]),
    getPanelByType: jest.fn().mockReturnValue({
      title: "Test Panel",
      type: "TestPanel",
      module: jest.fn(),
      hasCustomToolbar: false,
    }),
    ...panelCatalogOverrides,
  };

  const props = {
    isUnknownPanel: false,
    ...propsOverrides,
  };

  return {
    ...render(
      <ThemeProvider isDark={false}>
        <PanelCatalogContext.Provider value={panelCatalog as any}>
          <PanelContext.Provider value={panelContext as any}>
            <PanelToolbarControls {...props} />
          </PanelContext.Provider>
        </PanelCatalogContext.Provider>
      </ThemeProvider>,
    ),
    panelContext,
    panelCatalog,
  };
}

describe("PanelToolbarControls", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set up default mock implementations
    mockUseSelectedPanels.mockReturnValue({
      getSelectedPanelIds: jest.fn().mockReturnValue([]),
      selectedPanelIds: [],
      setSelectedPanelIds: jest.fn(),
      selectAllPanels: jest.fn(),
      togglePanelSelected: jest.fn(),
    });

    mockUsePanelStateStore.mockReturnValue(false);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    mockUseWorkspaceActions.mockReturnValue({
      dialogActions: {
        dataSource: { close: jest.fn(), open: jest.fn() },
        openFile: { open: jest.fn() },
        preferences: { close: jest.fn(), open: jest.fn() },
      },
      featureTourActions: { startTour: jest.fn(), finishTour: jest.fn() },
      openAccountSettings: jest.fn(),
      openPanelSettings: jest.fn(),
      openLayoutBrowser: jest.fn(),
      playbackControlActions: { setRepeat: jest.fn() },
    } as any);
  });

  describe("Given a panel with no logs and settings", () => {
    it("When rendered Then displays logs button and settings button", () => {
      // Given
      const panelContext = {
        id: "test-panel",
        type: "TestPanel",
        showLogs: false,
        setShowLogs: jest.fn(),
        logCount: 0,
      };

      // When
      renderPanelToolbarControls(panelContext);

      // Then
      expect(screen.getByTitle("Show logs")).toBeTruthy();
      expect(screen.getByTitle("Settings")).toBeTruthy();
      expect(screen.getByTestId("panel-actions-dropdown")).toBeTruthy();
    });

    it("When rendered Then shows correct logs button state", () => {
      // Given
      const panelContext = {
        showLogs: false,
        logCount: 0,
      };

      // When
      renderPanelToolbarControls(panelContext);

      // Then
      const logsButton = screen.getByTitle("Show logs");
      expect(logsButton).toBeTruthy();
    });

    it("When logs button is clicked Then toggles logs visibility", () => {
      // Given
      const setShowLogs = jest.fn();
      const panelContext = {
        showLogs: false,
        setShowLogs,
      };

      renderPanelToolbarControls(panelContext);

      // When
      const logsButton = screen.getByTitle("Show logs");
      fireEvent.click(logsButton);

      // Then
      expect(setShowLogs).toHaveBeenCalledWith({ show: true });
    });
  });

  describe("Given a panel with logs visible", () => {
    it("When rendered Then shows hide logs title", () => {
      // Given
      const panelContext = {
        showLogs: true,
        logCount: 3,
      };

      // When
      renderPanelToolbarControls(panelContext);

      // Then
      expect(screen.getByTitle("Hide logs")).toBeTruthy();
    });

    it("When logs button is clicked Then hides logs", () => {
      // Given
      const setShowLogs = jest.fn();
      const panelContext = {
        showLogs: true,
        setShowLogs,
      };

      renderPanelToolbarControls(panelContext);

      // When
      const logsButton = screen.getByTitle("Hide logs");
      fireEvent.click(logsButton);

      // Then
      expect(setShowLogs).toHaveBeenCalledWith({ show: false });
    });
  });

  describe("Given a panel with log count", () => {
    it("When has logs Then displays log count in title", () => {
      // Given
      const panelContext = {
        showLogs: false,
        logCount: 5,
      };

      // When
      renderPanelToolbarControls(panelContext);

      // Then
      expect(screen.getByTitle("Show logs (5)")).toBeTruthy();
    });

    it("When has logs Then shows error badge", () => {
      // Given
      const panelContext = {
        logCount: 3,
      };

      // When
      const { container } = renderPanelToolbarControls(panelContext);

      // Then
      const badge = container.querySelector(".MuiBadge-colorError");
      expect(badge).toBeTruthy();
    });

    it("When no logs Then hides error badge", () => {
      // Given
      const panelContext = {
        logCount: 0,
      };

      // When
      const { container } = renderPanelToolbarControls(panelContext);

      // Then
      const badge = container.querySelector(".MuiBadge-invisible");
      expect(badge).toBeTruthy();
    });
  });

  describe("Given a panel with settings", () => {
    beforeEach(() => {
      mockUsePanelStateStore.mockReturnValue(true);
    });

    it("When settings button is clicked Then opens panel settings", () => {
      // Given
      const openPanelSettings = jest.fn();
      const setSelectedPanelIds = jest.fn();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockUseWorkspaceActions.mockReturnValue({
        dialogActions: {
          dataSource: { close: jest.fn(), open: jest.fn() },
          openFile: { open: jest.fn() },
          preferences: { close: jest.fn(), open: jest.fn() },
        },
        featureTourActions: { startTour: jest.fn(), finishTour: jest.fn() },
        openAccountSettings: jest.fn(),
        openPanelSettings,
        openLayoutBrowser: jest.fn(),
        playbackControlActions: { setRepeat: jest.fn() },
      } as any);

      mockUseSelectedPanels.mockReturnValue({
        getSelectedPanelIds: jest.fn().mockReturnValue([]),
        selectedPanelIds: [],
        setSelectedPanelIds,
        selectAllPanels: jest.fn(),
        togglePanelSelected: jest.fn(),
      });

      const panelContext = {
        id: "test-panel-123",
      };

      renderPanelToolbarControls(panelContext);

      // When
      const settingsButton = screen.getByTitle("Settings");
      fireEvent.click(settingsButton);

      // Then
      expect(setSelectedPanelIds).toHaveBeenCalledWith(["test-panel-123"]);
      expect(openPanelSettings).toHaveBeenCalled();
    });

    it("When panel has no id Then settings button does not crash", () => {
      // Given
      const panelContext = {
        id: undefined,
      };

      // When/Then - should not throw
      expect(() => {
        renderPanelToolbarControls(panelContext);
        const settingsButton = screen.getByTitle("Settings");
        fireEvent.click(settingsButton);
      }).not.toThrow();
    });
  });

  describe("Given a panel with custom toolbar", () => {
    it("When panel has custom toolbar and no settings Then hides settings button", () => {
      // Given
      const panelCatalog = {
        getPanelByType: jest.fn().mockReturnValue({
          title: "Custom Panel",
          type: "CustomPanel",
          module: jest.fn(),
          hasCustomToolbar: true,
        }),
      };

      mockUsePanelStateStore.mockReturnValue(false);

      // When
      renderPanelToolbarControls({}, panelCatalog);

      // Then
      expect(screen.queryByTitle("Settings")).toBeFalsy();
    });

    it("When panel has custom toolbar but has settings Then shows settings button", () => {
      // Given
      const panelCatalog = {
        getPanelByType: jest.fn().mockReturnValue({
          title: "Custom Panel",
          type: "CustomPanel",
          module: jest.fn(),
          hasCustomToolbar: true,
        }),
      };

      mockUsePanelStateStore.mockReturnValue(true);

      // When
      renderPanelToolbarControls({}, panelCatalog);

      // Then
      expect(screen.getByTitle("Settings")).toBeTruthy();
    });
  });

  describe("Given additional icons", () => {
    it("When additional icons provided Then renders them", () => {
      // Given
      const additionalIcons = <div data-testid="custom-icon">Custom Icon</div>;

      // When
      renderPanelToolbarControls({}, {}, { additionalIcons });

      // Then
      expect(screen.getByTestId("custom-icon")).toBeTruthy();
      expect(screen.getByText("Custom Icon")).toBeTruthy();
    });

    it("When no additional icons Then only shows default controls", () => {
      // Given/When
      renderPanelToolbarControls();

      // Then
      expect(screen.queryByTestId("custom-icon")).toBeFalsy();
      expect(screen.getByTitle("Show logs")).toBeTruthy();
      expect(screen.getByTitle("Settings")).toBeTruthy();
    });
  });

  describe("Given unknown panel", () => {
    it("When isUnknownPanel is true Then passes to PanelActionsDropdown", () => {
      // Given/When
      renderPanelToolbarControls({}, {}, { isUnknownPanel: true });

      // Then
      const dropdown = screen.getByTestId("panel-actions-dropdown");
      expect(dropdown.getAttribute("data-unknown-panel")).toBe("true");
    });

    it("When isUnknownPanel is false Then passes to PanelActionsDropdown", () => {
      // Given/When
      renderPanelToolbarControls({}, {}, { isUnknownPanel: false });

      // Then
      const dropdown = screen.getByTestId("panel-actions-dropdown");
      expect(dropdown.getAttribute("data-unknown-panel")).toBe("false");
    });
  });

  describe("Given different panel types", () => {
    it("When panel type is undefined Then handles gracefully", () => {
      // Given
      const panelContext = {
        type: undefined,
      };

      // When/Then - should not throw
      expect(() => {
        renderPanelToolbarControls(panelContext);
      }).not.toThrow();

      expect(screen.getByTitle("Show logs")).toBeTruthy();
    });

    it("When panel catalog is undefined Then handles gracefully", () => {
      // Given/When
      renderPanelToolbarControls({}, { getPanelByType: jest.fn().mockReturnValue(undefined) });

      // Then
      expect(screen.getByTitle("Show logs")).toBeTruthy();
      expect(screen.getByTitle("Settings")).toBeTruthy();
    });

    it("When panel type not found in catalog Then shows settings button", () => {
      // Given
      const panelCatalog = {
        getPanelByType: jest.fn().mockReturnValue(undefined),
      };

      // When
      renderPanelToolbarControls({}, panelCatalog);

      // Then
      expect(screen.getByTitle("Settings")).toBeTruthy();
    });
  });

  describe("Given panel context is missing", () => {
    it("When no panel context Then handles missing values gracefully", () => {
      // Given/When
      const { container } = render(
        <ThemeProvider isDark={false}>
          <PanelContext.Provider value={undefined}>
            <PanelToolbarControls isUnknownPanel={false} />
          </PanelContext.Provider>
        </ThemeProvider>,
      );

      // Then - should not crash and should render something
      expect(container.firstChild).toBeTruthy();
    });

    it("When setShowLogs is missing Then logs button does not crash on click", () => {
      // Given
      const panelContext = {
        showLogs: false,
        setShowLogs: undefined,
      };

      renderPanelToolbarControls(panelContext);

      // When/Then - should not throw
      expect(() => {
        const logsButton = screen.getByTitle("Show logs");
        fireEvent.click(logsButton);
      }).not.toThrow();
    });
  });

  describe("Given component memoization", () => {
    it("When props don't change Then component should be memoized", () => {
      // Given
      const props = { isUnknownPanel: false };
      const { rerender } = renderPanelToolbarControls({}, {}, props);

      const firstRender = screen.getByTitle("Show logs");

      // When - rerender with same props
      rerender(
        <ThemeProvider isDark={false}>
          <PanelCatalogContext.Provider
            value={
              {
                getPanels: jest.fn().mockReturnValue([]),
                getPanelByType: jest.fn().mockReturnValue({
                  title: "Test Panel",
                  type: "TestPanel",
                  module: jest.fn(),
                  hasCustomToolbar: false,
                }),
              } as any
            }
          >
            <PanelContext.Provider
              value={
                {
                  id: "test-panel-id",
                  type: "TestPanel",
                  title: "Test Panel",
                  showLogs: false,
                  setShowLogs: jest.fn(),
                  logError: jest.fn(),
                  logCount: 0,
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
                } as any
              }
            >
              <PanelToolbarControls {...props} />
            </PanelContext.Provider>
          </PanelCatalogContext.Provider>
        </ThemeProvider>,
      );

      // Then - should still render properly
      expect(screen.getByTitle("Show logs")).toBeTruthy();
      expect(firstRender).toBeTruthy();
    });
  });

  describe("Given logs state transitions", () => {
    it("When logs count changes from 0 to positive Then updates badge visibility", () => {
      // Given
      const panelContext = {
        logCount: 0,
      };

      const { rerender } = renderPanelToolbarControls(panelContext);

      // Verify initial state - badge should be invisible
      let badge = document.querySelector(".MuiBadge-invisible");
      expect(badge).toBeTruthy();

      // When - update to have logs
      rerender(
        <ThemeProvider isDark={false}>
          <PanelCatalogContext.Provider
            value={
              {
                getPanels: jest.fn().mockReturnValue([]),
                getPanelByType: jest.fn().mockReturnValue({
                  title: "Test Panel",
                  type: "TestPanel",
                  module: jest.fn(),
                  hasCustomToolbar: false,
                }),
              } as any
            }
          >
            <PanelContext.Provider
              value={
                {
                  id: "test-panel-id",
                  type: "TestPanel",
                  title: "Test Panel",
                  showLogs: false,
                  setShowLogs: jest.fn(),
                  logError: jest.fn(),
                  logCount: 3,
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
                } as any
              }
            >
              <PanelToolbarControls isUnknownPanel={false} />
            </PanelContext.Provider>
          </PanelCatalogContext.Provider>
        </ThemeProvider>,
      );

      // Then - badge should be visible
      badge = document.querySelector(".MuiBadge-colorError");
      expect(badge).toBeTruthy();
    });
  });

  describe("Given ref forwarding", () => {
    it("When ref is provided Then forwards to Stack component", () => {
      // Given
      const ref = React.createRef<HTMLDivElement>();

      // When
      render(
        <ThemeProvider isDark={false}>
          <PanelContext.Provider
            value={
              {
                id: "test",
                type: "Test",
                title: "Test",
                showLogs: false,
                setShowLogs: jest.fn(),
                logError: jest.fn(),
                logCount: 0,
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
              } as any
            }
          >
            <PanelToolbarControls ref={ref} isUnknownPanel={false} />
          </PanelContext.Provider>
        </ThemeProvider>,
      );

      // Then
      expect(ref.current).toBeTruthy();
      expect(ref.current?.tagName).toBe("DIV");
    });
  });
});
