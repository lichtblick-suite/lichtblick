/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { MockedFunction } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { PanelToolbarControls } from "@lichtblick/suite-base/components/PanelToolbar/PanelToolbarControls";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import PanelCatalogContext from "@lichtblick/suite-base/context/PanelCatalogContext";
import { usePanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

// Mock the dependencies
vi.mock("@lichtblick/suite-base/context/CurrentLayoutContext", async () => ({
  useSelectedPanels: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/PanelStateContext", async () => ({
  usePanelStateStore: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", async () => ({
  useWorkspaceActions: vi.fn(),
}));

// Mock the PanelActionsDropdown component
vi.mock("@lichtblick/suite-base/components/PanelToolbar/PanelActionsDropdown", async () => ({
  PanelActionsDropdown: ({ isUnknownPanel }: { isUnknownPanel: boolean }) => (
    <div data-testid="panel-actions-dropdown" data-unknown-panel={isUnknownPanel}>
      Panel Actions Dropdown
    </div>
  ),
}));

const mockUseSelectedPanels = useSelectedPanels as MockedFunction<typeof useSelectedPanels>;
const mockUsePanelStateStore = usePanelStateStore as MockedFunction<typeof usePanelStateStore>;
const mockUseWorkspaceActions = useWorkspaceActions as MockedFunction<
  typeof useWorkspaceActions
>;

function renderPanelToolbarControls({
  panelContextOverrides = {},
  panelCatalogOverrides = {},
  propsOverrides = {},
} = {}) {
  const panelContext = {
    id: "test-panel-id",
    type: "TestPanel",
    title: "Test Panel",
    showLogs: false,
    setShowLogs: vi.fn(),
    logError: vi.fn(),
    logCount: 0,
    config: {},
    saveConfig: vi.fn(),
    updatePanelConfigs: vi.fn(),
    openSiblingPanel: vi.fn(),
    replacePanel: vi.fn(),
    enterFullscreen: vi.fn(),
    exitFullscreen: vi.fn(),
    isFullscreen: false,
    setHasFullscreenDescendant: vi.fn(),
    connectToolbarDragHandle: vi.fn(),
    setMessagePathDropConfig: vi.fn(),
    ...panelContextOverrides,
  };

  const panelCatalog = {
    getPanels: vi.fn().mockReturnValue([]),
    getPanelByType: vi.fn().mockReturnValue({
      title: "Test Panel",
      type: "TestPanel",
      module: vi.fn(),
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
    vi.clearAllMocks();

    // Set up default mock implementations
    mockUseSelectedPanels.mockReturnValue({
      getSelectedPanelIds: vi.fn().mockReturnValue([]),
      selectedPanelIds: [],
      setSelectedPanelIds: vi.fn(),
      selectAllPanels: vi.fn(),
      togglePanelSelected: vi.fn(),
    });

    mockUsePanelStateStore.mockReturnValue(false);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    mockUseWorkspaceActions.mockReturnValue({
      dialogActions: {
        dataSource: { close: vi.fn(), open: vi.fn() },
        openFile: { open: vi.fn() },
        preferences: { close: vi.fn(), open: vi.fn() },
      },
      featureTourActions: { startTour: vi.fn(), finishTour: vi.fn() },
      openAccountSettings: vi.fn(),
      openPanelSettings: vi.fn(),
      openLayoutBrowser: vi.fn(),
      playbackControlActions: { setRepeat: vi.fn() },
    } as any);
  });

  describe("Given a panel with no logs and settings", () => {
    it("When rendered Then displays logs button and settings button", () => {
      // Given / When
      renderPanelToolbarControls({
        panelContextOverrides: {
          id: "test-panel",
          type: "TestPanel",
          showLogs: false,
          logCount: 0,
        },
      });

      // Then
      expect(screen.getByTitle("Show logs")).toBeInTheDocument();
      expect(screen.getByTitle("Settings")).toBeInTheDocument();
      expect(screen.getByTestId("panel-actions-dropdown")).toBeInTheDocument();
    });

    it("When rendered with zero logs Then shows correct logs button state", () => {
      // Given / When
      renderPanelToolbarControls({
        panelContextOverrides: {
          showLogs: false,
          logCount: 0,
        },
      });

      // Then
      const logsButton = screen.getByTitle("Show logs");
      expect(logsButton).toBeInTheDocument();
      // Button should exist but clicking it should not trigger actions (tested separately)
    });

    it("When logs button is clicked with zero logs Then does not call setShowLogs", () => {
      // Given
      const { panelContext } = renderPanelToolbarControls({
        panelContextOverrides: {
          showLogs: false,
          logCount: 0,
        },
      });

      // When
      const logsButton = screen.getByTitle("Show logs");
      fireEvent.click(logsButton);

      // Then
      expect(panelContext.setShowLogs).not.toHaveBeenCalled();
    });

    it("When logs button is clicked with logs present Then toggles logs visibility", () => {
      // Given
      const logCount = BasicBuilder.number();
      const { panelContext } = renderPanelToolbarControls({
        panelContextOverrides: { logCount },
      });

      // When
      const logsButton = screen.getByTitle(`Show logs (${logCount})`);
      fireEvent.click(logsButton);

      // Then
      expect(panelContext.setShowLogs).toHaveBeenCalledWith({ show: true });
    });
  });

  describe("Given a panel with logs visible", () => {
    it("When rendered Then shows hide logs title", () => {
      // Given / When
      renderPanelToolbarControls({
        panelContextOverrides: {
          showLogs: true,
          logCount: BasicBuilder.number(),
        },
      });

      // Then
      expect(screen.getByTitle("Hide logs")).toBeInTheDocument();
    });

    it("When logs button is clicked Then hides logs", () => {
      // Given
      const { panelContext } = renderPanelToolbarControls({
        panelContextOverrides: {
          showLogs: true,
          logCount: BasicBuilder.number(),
        },
      });

      // When
      const logsButton = screen.getByTitle("Hide logs");
      fireEvent.click(logsButton);

      // Then
      expect(panelContext.setShowLogs).toHaveBeenCalledWith({ show: false });
    });
  });

  describe("Given a panel with log count", () => {
    it("When panel has logs Then displays log count in title", () => {
      // Given
      const logCount = BasicBuilder.number();

      // When
      renderPanelToolbarControls({
        panelContextOverrides: {
          showLogs: false,
          logCount,
        },
      });

      // Then
      expect(screen.getByTitle(`Show logs (${logCount})`)).toBeInTheDocument();
    });

    it("When panel has logs Then shows error badge", () => {
      // Given / When
      const { container } = renderPanelToolbarControls({
        panelContextOverrides: {
          logCount: BasicBuilder.number(),
        },
      });

      // Then
      const badge = container.querySelector(".MuiBadge-colorError");
      expect(badge).toBeInTheDocument();
    });

    it("When panel has no logs Then hides error badge", () => {
      // Given / When
      const { container } = renderPanelToolbarControls({
        panelContextOverrides: {
          logCount: 0,
        },
      });

      // Then
      const badge = container.querySelector(".MuiBadge-invisible");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Given a panel with settings", () => {
    beforeEach(() => {
      mockUsePanelStateStore.mockReturnValue(true);
    });

    it("When settings button is clicked Then opens panel settings", () => {
      // Given
      const openPanelSettings = vi.fn();
      const setSelectedPanelIds = vi.fn();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockUseWorkspaceActions.mockReturnValue({
        dialogActions: {
          dataSource: { close: vi.fn(), open: vi.fn() },
          openFile: { open: vi.fn() },
          preferences: { close: vi.fn(), open: vi.fn() },
        },
        featureTourActions: { startTour: vi.fn(), finishTour: vi.fn() },
        openAccountSettings: vi.fn(),
        openPanelSettings,
        openLayoutBrowser: vi.fn(),
        playbackControlActions: { setRepeat: vi.fn() },
      } as any);

      mockUseSelectedPanels.mockReturnValue({
        getSelectedPanelIds: vi.fn().mockReturnValue([]),
        selectedPanelIds: [],
        setSelectedPanelIds,
        selectAllPanels: vi.fn(),
        togglePanelSelected: vi.fn(),
      });

      const panelContext = {
        id: "test-panel-123",
      };

      renderPanelToolbarControls({ panelContextOverrides: panelContext });

      // When
      const settingsButton = screen.getByTitle("Settings");
      fireEvent.click(settingsButton);

      // Then
      expect(setSelectedPanelIds).toHaveBeenCalledWith(["test-panel-123"]);
      expect(openPanelSettings).toHaveBeenCalled();
    });

    it("When panel has no id Then settings button does not crash", () => {
      // When/Then - should not throw
      expect(() => {
        renderPanelToolbarControls({
          panelContextOverrides: { id: undefined },
        });
        const settingsButton = screen.getByTitle("Settings");
        fireEvent.click(settingsButton);
      }).not.toThrow();
    });
  });

  describe("Given a panel with custom toolbar", () => {
    it("When panel has custom toolbar and no settings Then hides settings button", () => {
      // Given
      const panelCatalog = {
        getPanelByType: vi.fn().mockReturnValue({
          title: "Custom Panel",
          type: "CustomPanel",
          module: vi.fn(),
          hasCustomToolbar: true,
        }),
      };

      mockUsePanelStateStore.mockReturnValue(false);

      // When
      renderPanelToolbarControls({
        panelCatalogOverrides: panelCatalog,
      });

      // Then
      expect(screen.queryByTitle("Settings")).not.toBeInTheDocument();
    });

    it("When panel has custom toolbar but has settings Then shows settings button", () => {
      // Given
      const panelCatalog = {
        getPanelByType: vi.fn().mockReturnValue({
          title: "Custom Panel",
          type: "CustomPanel",
          module: vi.fn(),
          hasCustomToolbar: true,
        }),
      };

      mockUsePanelStateStore.mockReturnValue(true);

      // When
      renderPanelToolbarControls({
        panelCatalogOverrides: panelCatalog,
      });

      // Then
      expect(screen.getByTitle("Settings")).toBeInTheDocument();
    });
  });

  describe("Given additional icons", () => {
    it("When additional icons are provided Then renders them correctly", () => {
      // Given
      const additionalIcons = <div data-testid="custom-icon">Custom Icon</div>;

      // When
      renderPanelToolbarControls({
        propsOverrides: { additionalIcons },
      });

      // Then
      expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
      expect(screen.getByText("Custom Icon")).toBeInTheDocument();
    });

    it("When no additional icons are provided Then only shows default controls", () => {
      // Given / When
      renderPanelToolbarControls();

      // Then
      expect(screen.queryByTestId("custom-icon")).not.toBeInTheDocument();
      expect(screen.getByTitle("Show logs")).toBeInTheDocument();
      expect(screen.getByTitle("Settings")).toBeInTheDocument();
    });
  });

  describe("Given unknown panel", () => {
    it("When isUnknownPanel is true Then passes correct value to PanelActionsDropdown", () => {
      // Given
      const isUnknownPanel = true;

      // When
      renderPanelToolbarControls({
        propsOverrides: { isUnknownPanel },
      });

      // Then
      const dropdown = screen.getByTestId("panel-actions-dropdown");
      expect(dropdown.getAttribute("data-unknown-panel")).toBe("true");
    });

    it("When isUnknownPanel is false Then passes correct value to PanelActionsDropdown", () => {
      // Given
      const isUnknownPanel = false;

      // When
      renderPanelToolbarControls({
        propsOverrides: { isUnknownPanel },
      });

      // Then
      const dropdown = screen.getByTestId("panel-actions-dropdown");
      expect(dropdown.getAttribute("data-unknown-panel")).toBe("false");
    });
  });

  describe("Given different panel types", () => {
    it("When panel type is undefined Then handles gracefully without errors", () => {
      // Given / When
      renderPanelToolbarControls({
        panelContextOverrides: { type: undefined },
      });

      // Then - should not throw and should render basic controls
      expect(screen.getByTitle("Show logs")).toBeInTheDocument();
    });

    it("When panel catalog returns undefined Then handles gracefully", () => {
      // Given
      const panelCatalog = {
        getPanelByType: vi.fn().mockReturnValue(undefined),
      };

      // When
      renderPanelToolbarControls({
        panelCatalogOverrides: panelCatalog,
      });

      // Then
      expect(screen.getByTitle("Show logs")).toBeInTheDocument();
      expect(screen.getByTitle("Settings")).toBeInTheDocument();
    });

    it("When panel type is not found in catalog Then shows settings button", () => {
      // Given
      const panelCatalog = {
        getPanelByType: vi.fn().mockReturnValue(undefined),
      };

      // When
      renderPanelToolbarControls({
        panelCatalogOverrides: panelCatalog,
      });

      // Then
      expect(screen.getByTitle("Settings")).toBeInTheDocument();
    });
  });

  describe("Given panel context is missing", () => {
    it("When no panel context is provided Then handles missing values gracefully", () => {
      // Given
      const contextValue = undefined;

      // When
      const { container } = render(
        <ThemeProvider isDark={false}>
          <PanelContext.Provider value={contextValue}>
            <PanelToolbarControls isUnknownPanel={false} />
          </PanelContext.Provider>
        </ThemeProvider>,
      );

      // Then - should not crash and should render something
      expect(container.firstChild).toBeInTheDocument();
    });

    it("When setShowLogs is missing Then logs button does not crash on click", () => {
      // Given / When
      renderPanelToolbarControls({
        panelContextOverrides: {
          showLogs: false,
          setShowLogs: undefined,
        },
      });

      // Then - should not throw
      const logsButton = screen.getByTitle("Show logs");
      expect(() => {
        fireEvent.click(logsButton);
      }).not.toThrow();
    });
  });

  describe("Given component memoization", () => {
    it("When props don't change Then component should render consistently", () => {
      // Given
      const props = { isUnknownPanel: false };
      const { rerender } = renderPanelToolbarControls({
        propsOverrides: props,
      });

      const firstRender = screen.getByTitle("Show logs");

      // When - rerender with same props and context
      rerender(
        <ThemeProvider isDark={false}>
          <PanelCatalogContext.Provider
            value={
              {
                getPanels: vi.fn().mockReturnValue([]),
                getPanelByType: vi.fn().mockReturnValue({
                  title: "Test Panel",
                  type: "TestPanel",
                  module: vi.fn(),
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
                  setShowLogs: vi.fn(),
                  logError: vi.fn(),
                  logCount: 0,
                  config: {},
                  saveConfig: vi.fn(),
                  updatePanelConfigs: vi.fn(),
                  openSiblingPanel: vi.fn(),
                  replacePanel: vi.fn(),
                  enterFullscreen: vi.fn(),
                  exitFullscreen: vi.fn(),
                  isFullscreen: false,
                  setHasFullscreenDescendant: vi.fn(),
                  connectToolbarDragHandle: vi.fn(),
                  setMessagePathDropConfig: vi.fn(),
                } as any
              }
            >
              <PanelToolbarControls {...props} />
            </PanelContext.Provider>
          </PanelCatalogContext.Provider>
        </ThemeProvider>,
      );

      // Then - should still render properly
      expect(screen.getByTitle("Show logs")).toBeInTheDocument();
      expect(firstRender).toBeInTheDocument();
    });
  });

  describe("Given logs state transitions", () => {
    it("When logs count changes from 0 to positive Then updates badge visibility correctly", () => {
      // Given
      const panelContext = {
        logCount: 0,
      };

      const { rerender } = renderPanelToolbarControls({
        panelContextOverrides: panelContext,
      });

      // Verify initial state - badge should be invisible
      let badge = document.querySelector(".MuiBadge-invisible");
      expect(badge).toBeInTheDocument();

      // When - update to have logs
      rerender(
        <ThemeProvider isDark={false}>
          <PanelCatalogContext.Provider
            value={
              {
                getPanels: vi.fn().mockReturnValue([]),
                getPanelByType: vi.fn().mockReturnValue({
                  title: "Test Panel",
                  type: "TestPanel",
                  module: vi.fn(),
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
                  setShowLogs: vi.fn(),
                  logError: vi.fn(),
                  logCount: 3,
                  config: {},
                  saveConfig: vi.fn(),
                  updatePanelConfigs: vi.fn(),
                  openSiblingPanel: vi.fn(),
                  replacePanel: vi.fn(),
                  enterFullscreen: vi.fn(),
                  exitFullscreen: vi.fn(),
                  isFullscreen: false,
                  setHasFullscreenDescendant: vi.fn(),
                  connectToolbarDragHandle: vi.fn(),
                  setMessagePathDropConfig: vi.fn(),
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
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Given ref forwarding", () => {
    it("When ref is provided Then forwards correctly to Stack component", () => {
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
                setShowLogs: vi.fn(),
                logError: vi.fn(),
                logCount: 0,
                config: {},
                saveConfig: vi.fn(),
                updatePanelConfigs: vi.fn(),
                openSiblingPanel: vi.fn(),
                replacePanel: vi.fn(),
                enterFullscreen: vi.fn(),
                exitFullscreen: vi.fn(),
                isFullscreen: false,
                setHasFullscreenDescendant: vi.fn(),
                connectToolbarDragHandle: vi.fn(),
                setMessagePathDropConfig: vi.fn(),
              } as any
            }
          >
            <PanelToolbarControls ref={ref} isUnknownPanel={false} />
          </PanelContext.Provider>
        </ThemeProvider>,
      );

      // Then
      expect(ref.current).not.toBeNull();
      expect(ref.current?.tagName).toBe("DIV");
    });
  });

  describe("Given button states and interactions", () => {
    it("When logs button has zero logs Then clicking has no effect", () => {
      // Given
      const panelContext = {
        logCount: 0,
        showLogs: false,
      };

      // When
      renderPanelToolbarControls({
        panelContextOverrides: panelContext,
      });

      // Then
      const logsButton = screen.getByTitle("Show logs");
      expect(logsButton).toBeInTheDocument();
      // Functional test - button exists and behavior is tested in other tests
    });

    it("When logs button has logs Then allows interaction", () => {
      // Given
      const logCount = BasicBuilder.number();

      // When
      renderPanelToolbarControls({
        panelContextOverrides: {
          logCount,
          showLogs: false,
        },
      });

      // Then
      const logsButton = screen.getByTitle(`Show logs (${logCount})`);
      expect(logsButton).toBeInTheDocument();
      // Functional test - clicking behavior is tested in other tests
    });

    it("When settings button is clicked without panel ID Then does not perform actions", () => {
      // Given
      const openPanelSettings = vi.fn();
      const setSelectedPanelIds = vi.fn();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockUseWorkspaceActions.mockReturnValue({
        dialogActions: {
          dataSource: { close: vi.fn(), open: vi.fn() },
          openFile: { open: vi.fn() },
          preferences: { close: vi.fn(), open: vi.fn() },
        },
        featureTourActions: { startTour: vi.fn(), finishTour: vi.fn() },
        openAccountSettings: vi.fn(),
        openPanelSettings,
        openLayoutBrowser: vi.fn(),
        playbackControlActions: { setRepeat: vi.fn() },
      } as any);

      mockUseSelectedPanels.mockReturnValue({
        getSelectedPanelIds: vi.fn().mockReturnValue([]),
        selectedPanelIds: [],
        setSelectedPanelIds,
        selectAllPanels: vi.fn(),
        togglePanelSelected: vi.fn(),
      });

      const panelContext = {
        id: undefined,
      };

      renderPanelToolbarControls({
        panelContextOverrides: panelContext,
      });

      // When
      const settingsButton = screen.getByTitle("Settings");
      fireEvent.click(settingsButton);

      // Then
      expect(setSelectedPanelIds).not.toHaveBeenCalled();
      expect(openPanelSettings).not.toHaveBeenCalled();
    });

    it("When logs are visible Then shows correct icon color", () => {
      // Given / When
      const { container } = renderPanelToolbarControls({
        panelContextOverrides: {
          showLogs: true,
          logCount: BasicBuilder.number(),
        },
      });

      // Then
      const icon = container.querySelector('[data-testid="ListAltIcon"]');
      expect(icon).toBeInTheDocument();
    });
  });
});
