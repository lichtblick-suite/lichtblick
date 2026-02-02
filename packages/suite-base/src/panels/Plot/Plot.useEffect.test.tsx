/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";
import { useEffect } from "react";

import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import { BasicBuilder } from "@lichtblick/test-builders";

// Create a test wrapper that replicates the exact useEffect logic from Plot.tsx (lines 127-134).
// This allows us to test the useEffect behavior in isolation without the complexity of rendering
// the full Plot component with all its required React contexts and dependencies.

function useTestPlotEffect({
  coordinator,
  config,
  globalVariables,
  themeMode,
  getMessagePipelineState,
}: {
  coordinator:
    | {
        handleConfig: (
          config: PlotConfig,
          mode: string,
          globalVariables: Record<string, unknown>,
        ) => void;
        handlePlayerState: (playerState: unknown) => void;
      }
    | undefined;
  config: PlotConfig;
  globalVariables: Record<string, unknown>;
  themeMode: string;
  getMessagePipelineState: () => { playerState: unknown };
}) {
  useEffect(() => {
    coordinator?.handleConfig(config, themeMode, globalVariables);
    // When config changes (e.g., series reordering) and the player is paused,
    // we need to re-process the current player state to update the rendered data
    if (coordinator) {
      coordinator.handlePlayerState(getMessagePipelineState().playerState);
    }
  }, [coordinator, config, globalVariables, themeMode, getMessagePipelineState]);
}

describe("Plot Component - useEffect config and coordinator synchronization", () => {
  let mockCoordinator: {
    handleConfig: jest.Mock;
    handlePlayerState: jest.Mock;
  };
  let mockGetMessagePipelineState: jest.Mock;
  let mockPlayerState: { activeData: { messages: unknown[] } };
  let mockConfig: PlotConfig;
  let mockGlobalVariables: Record<string, unknown>;
  let mockThemeMode: string;

  beforeEach(() => {
    mockCoordinator = {
      handleConfig: jest.fn(),
      handlePlayerState: jest.fn(),
    };

    mockPlayerState = { activeData: { messages: [] } };
    mockGetMessagePipelineState = jest.fn().mockReturnValue({
      playerState: mockPlayerState,
    });

    mockConfig = {
      paths: [{ value: BasicBuilder.string(), enabled: true, timestampMethod: "receiveTime" }],
      xAxisVal: "timestamp",
      showLegend: true,
      isSynced: false,
      legendDisplay: "floating",
      showPlotValuesInLegend: true,
      showXAxisLabels: true,
      showYAxisLabels: true,
      sidebarDimension: 240,
    };

    mockGlobalVariables = { var1: BasicBuilder.string() };
    mockThemeMode = "dark";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("given-when-then: handleConfig behavior", () => {
    it("should call handleConfig with config, theme mode, and globalVariables when coordinator is created", () => {
      // Given: A coordinator, config, theme mode, and global variables are available
      const coordinator = mockCoordinator;
      const config = mockConfig;
      const globalVariables = mockGlobalVariables;
      const themeMode = mockThemeMode;
      const getMessagePipelineState = mockGetMessagePipelineState;

      // When: The useEffect executes (simulating the Plot component's behavior)
      renderHook(() => {
        useTestPlotEffect({
          coordinator,
          config,
          globalVariables,
          themeMode,
          getMessagePipelineState,
        });
      });

      // Then: handleConfig should be called with correct parameters
      expect(mockCoordinator.handleConfig).toHaveBeenCalledWith(config, themeMode, globalVariables);
      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(1);
    });

    it("should re-run effect when config changes", () => {
      // Given: Initial config with one path
      const coordinator = mockCoordinator;
      const topic1 = BasicBuilder.string();
      const initialConfig: PlotConfig = {
        ...mockConfig,
        paths: [{ value: topic1, enabled: true, timestampMethod: "receiveTime" }],
      };
      const globalVariables = mockGlobalVariables;
      const themeMode = mockThemeMode;
      const getMessagePipelineState = mockGetMessagePipelineState;

      const { rerender } = renderHook(
        ({ config }) => {
          useTestPlotEffect({
            coordinator,
            config,
            globalVariables,
            themeMode,
            getMessagePipelineState,
          });
        },
        { initialProps: { config: initialConfig } },
      );

      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(1);

      // When: Config changes to add another path
      const topic2 = BasicBuilder.string();
      const updatedConfig: PlotConfig = {
        ...mockConfig,
        paths: [
          { value: topic1, enabled: true, timestampMethod: "receiveTime" },
          { value: topic2, enabled: true, timestampMethod: "receiveTime" },
        ],
      };
      rerender({ config: updatedConfig });

      // Then: handleConfig should be called again with updated config
      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(2);
      expect(mockCoordinator.handleConfig).toHaveBeenCalledWith(
        updatedConfig,
        themeMode,
        globalVariables,
      );
    });

    it("should re-run effect when globalVariables change", () => {
      // Given: Initial global variables
      const coordinator = mockCoordinator;
      const config = mockConfig;
      const varName1 = BasicBuilder.string();
      const initialValue = BasicBuilder.string();
      const initialGlobalVariables = { [varName1]: initialValue };
      const themeMode = mockThemeMode;
      const getMessagePipelineState = mockGetMessagePipelineState;

      const { rerender } = renderHook(
        ({ globalVariables }) => {
          useTestPlotEffect({
            coordinator,
            config,
            globalVariables,
            themeMode,
            getMessagePipelineState,
          });
        },
        { initialProps: { globalVariables: initialGlobalVariables } },
      );

      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(1);

      // When: Global variables change
      const varName2 = BasicBuilder.string();
      const updatedValue = BasicBuilder.string();
      const anotherValue = BasicBuilder.string();
      const updatedGlobalVariables = { [varName1]: updatedValue, [varName2]: anotherValue };
      rerender({ globalVariables: updatedGlobalVariables });

      // Then: handleConfig should be called again with new global variables
      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(2);
      expect(mockCoordinator.handleConfig).toHaveBeenCalledWith(
        config,
        themeMode,
        updatedGlobalVariables,
      );
    });

    it("should re-run effect when theme mode changes", () => {
      // Given: Initial theme mode
      const coordinator = mockCoordinator;
      const config = mockConfig;
      const globalVariables = mockGlobalVariables;
      const initialThemeMode = "dark";
      const getMessagePipelineState = mockGetMessagePipelineState;

      const { rerender } = renderHook(
        ({ themeMode }) => {
          useTestPlotEffect({
            coordinator,
            config,
            globalVariables,
            themeMode,
            getMessagePipelineState,
          });
        },
        { initialProps: { themeMode: initialThemeMode } },
      );

      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(1);

      // When: Theme mode changes from dark to light
      const updatedThemeMode = "light";
      rerender({ themeMode: updatedThemeMode });

      // Then: handleConfig should be called again with new theme mode
      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(2);
      expect(mockCoordinator.handleConfig).toHaveBeenCalledWith(
        config,
        updatedThemeMode,
        globalVariables,
      );
    });
  });

  describe("given-when-then: handlePlayerState behavior", () => {
    it("should call handlePlayerState after handleConfig when coordinator is created", () => {
      // Given: A coordinator and player state are available
      const coordinator = mockCoordinator;
      const config = mockConfig;
      const globalVariables = mockGlobalVariables;
      const themeMode = mockThemeMode;
      const getMessagePipelineState = mockGetMessagePipelineState;

      // When: The useEffect executes
      renderHook(() => {
        useTestPlotEffect({
          coordinator,
          config,
          globalVariables,
          themeMode,
          getMessagePipelineState,
        });
      });

      // Then: handlePlayerState should be called with player state
      expect(mockCoordinator.handlePlayerState).toHaveBeenCalledWith(mockPlayerState);
      expect(mockCoordinator.handlePlayerState).toHaveBeenCalledTimes(1);
    });

    it("should re-process player state when config changes (paused player scenario)", () => {
      // Given: A paused player with existing data
      const coordinator = mockCoordinator;
      const topicName = BasicBuilder.string();
      const pausedPlayerState = { activeData: { messages: [{ topic: topicName }] } };
      const getMessagePipelineState = jest.fn().mockReturnValue({
        playerState: pausedPlayerState,
      });

      const topic1 = BasicBuilder.string();
      const initialConfig: PlotConfig = {
        ...mockConfig,
        paths: [{ value: topic1, enabled: true, timestampMethod: "receiveTime" }],
      };
      const globalVariables = mockGlobalVariables;
      const themeMode = mockThemeMode;

      const { rerender } = renderHook(
        ({ config }) => {
          useTestPlotEffect({
            coordinator,
            config,
            globalVariables,
            themeMode,
            getMessagePipelineState,
          });
        },
        { initialProps: { config: initialConfig } },
      );

      mockCoordinator.handlePlayerState.mockClear();

      // When: Config changes (e.g., series reordering) while player is paused
      const topic2 = BasicBuilder.string();
      const reorderedConfig: PlotConfig = {
        ...mockConfig,
        paths: [
          { value: topic2, enabled: true, timestampMethod: "receiveTime" },
          { value: topic1, enabled: true, timestampMethod: "receiveTime" },
        ],
      };
      rerender({ config: reorderedConfig });

      // Then: handlePlayerState should be called to re-render with new config
      expect(mockCoordinator.handlePlayerState).toHaveBeenCalledWith(pausedPlayerState);
    });
  });

  describe("given-when-then: execution order and integration", () => {
    it("should call handleConfig before handlePlayerState", () => {
      // Given: A coordinator with tracking for call order
      const coordinator = mockCoordinator;
      const config = mockConfig;
      const globalVariables = mockGlobalVariables;
      const themeMode = mockThemeMode;
      const getMessagePipelineState = mockGetMessagePipelineState;
      const callOrder: string[] = [];

      mockCoordinator.handleConfig.mockImplementation(() => {
        callOrder.push("handleConfig");
      });
      mockCoordinator.handlePlayerState.mockImplementation(() => {
        callOrder.push("handlePlayerState");
      });

      // When: The useEffect executes
      renderHook(() => {
        useTestPlotEffect({
          coordinator,
          config,
          globalVariables,
          themeMode,
          getMessagePipelineState,
        });
      });

      // Then: handleConfig should be called before handlePlayerState
      expect(callOrder).toEqual(["handleConfig", "handlePlayerState"]);
      expect(callOrder.indexOf("handleConfig")).toBeLessThan(
        callOrder.indexOf("handlePlayerState"),
      );
    });

    it("should handle series reordering by updating config and re-processing player state", () => {
      // Given: A configuration with multiple series
      const coordinator = mockCoordinator;
      const topicA = BasicBuilder.string();
      const topicB = BasicBuilder.string();
      const topicC = BasicBuilder.string();
      const initialConfig: PlotConfig = {
        ...mockConfig,
        paths: [
          { value: topicA, enabled: true, timestampMethod: "receiveTime" },
          { value: topicB, enabled: true, timestampMethod: "receiveTime" },
          { value: topicC, enabled: true, timestampMethod: "receiveTime" },
        ],
      };
      const globalVariables = mockGlobalVariables;
      const themeMode = mockThemeMode;
      const getMessagePipelineState = mockGetMessagePipelineState;

      const { rerender } = renderHook(
        ({ config }) => {
          useTestPlotEffect({
            coordinator,
            config,
            globalVariables,
            themeMode,
            getMessagePipelineState,
          });
        },
        { initialProps: { config: initialConfig } },
      );

      mockCoordinator.handleConfig.mockClear();
      mockCoordinator.handlePlayerState.mockClear();

      // When: Series are reordered
      const reorderedConfig: PlotConfig = {
        ...mockConfig,
        paths: [
          { value: topicC, enabled: true, timestampMethod: "receiveTime" },
          { value: topicA, enabled: true, timestampMethod: "receiveTime" },
          { value: topicB, enabled: true, timestampMethod: "receiveTime" },
        ],
      };
      rerender({ config: reorderedConfig });

      // Then: Both handleConfig and handlePlayerState should be called
      expect(mockCoordinator.handleConfig).toHaveBeenCalledWith(
        reorderedConfig,
        themeMode,
        globalVariables,
      );
      expect(mockCoordinator.handlePlayerState).toHaveBeenCalledWith(mockPlayerState);
      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(1);
      expect(mockCoordinator.handlePlayerState).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple dependency changes in sequence", () => {
      // Given: Initial state with all dependencies
      const coordinator = mockCoordinator;
      const topic1 = BasicBuilder.string();
      const initialConfig: PlotConfig = {
        ...mockConfig,
        paths: [{ value: topic1, enabled: true, timestampMethod: "receiveTime" }],
      };
      const varName1 = BasicBuilder.string();
      const initialValue = BasicBuilder.string();
      const initialGlobalVariables = { [varName1]: initialValue };
      const initialThemeMode = "dark";
      const getMessagePipelineState = mockGetMessagePipelineState;

      const { rerender } = renderHook(
        ({ config, globalVariables, themeMode }) => {
          useTestPlotEffect({
            coordinator,
            config,
            globalVariables,
            themeMode,
            getMessagePipelineState,
          });
        },
        {
          initialProps: {
            config: initialConfig,
            globalVariables: initialGlobalVariables,
            themeMode: initialThemeMode,
          },
        },
      );

      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(1);

      // When: Config changes
      const topic2 = BasicBuilder.string();
      const updatedConfig: PlotConfig = {
        ...mockConfig,
        paths: [{ value: topic2, enabled: true, timestampMethod: "receiveTime" }],
      };
      rerender({
        config: updatedConfig,
        globalVariables: initialGlobalVariables,
        themeMode: initialThemeMode,
      });

      // When: Global variables change
      const varName2 = BasicBuilder.string();
      const updatedValue = BasicBuilder.string();
      const anotherValue = BasicBuilder.string();
      const updatedGlobalVariables = { [varName1]: updatedValue, [varName2]: anotherValue };
      rerender({
        config: updatedConfig,
        globalVariables: updatedGlobalVariables,
        themeMode: initialThemeMode,
      });

      // When: Theme mode changes
      rerender({
        config: updatedConfig,
        globalVariables: updatedGlobalVariables,
        themeMode: "light",
      });

      // Then: handleConfig should have been called for each change
      expect(mockCoordinator.handleConfig).toHaveBeenCalledTimes(4); // Initial + 3 changes
      expect(mockCoordinator.handlePlayerState).toHaveBeenCalledTimes(4);
    });
  });
});
