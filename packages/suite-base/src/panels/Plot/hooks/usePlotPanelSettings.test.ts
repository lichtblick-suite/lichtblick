/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import * as _ from "lodash-es";

import {
  SettingsTreeAction,
  SettingsTreeActionPerformNode,
  SettingsTreeActionUpdate,
  SettingsTreeActionReorder,
} from "@lichtblick/suite";
import { DEFAULT_PLOT_PATH } from "@lichtblick/suite-base/panels/Plot/constants";
import usePlotPanelSettings, {
  handleAddSeriesAction,
  handleDeleteSeriesAction,
  handleMoveSeriesAction,
  handleUpdateAction,
} from "@lichtblick/suite-base/panels/Plot/hooks/usePlotPanelSettings";
import {
  HandleAction,
  HandleDeleteSeriesAction,
  HandleMoveSeriesAction,
  HandleUpdateAction,
} from "@lichtblick/suite-base/panels/Plot/types";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import PlotBuilder from "@lichtblick/suite-base/testing/builders/PlotBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", () => ({
  usePanelSettingsTreeUpdate: jest.fn(() => jest.fn()),
}));

describe("handleUpdateAction", () => {
  it("should update path", () => {
    const initialConfig = PlotBuilder.config({ paths: [] });
    const input: HandleUpdateAction = {
      draft: _.cloneDeep(initialConfig),
      path: ["paths", "0", BasicBuilder.string()],
      value: BasicBuilder.string(),
    };

    handleUpdateAction(input);

    expect(input.draft.paths[0]).toEqual({ ...DEFAULT_PLOT_PATH, [input.path[2]!]: input.value });
  });

  it("should update path when has visible", () => {
    const initialConfig = PlotBuilder.config({ paths: [] });
    const input: HandleUpdateAction = {
      draft: _.cloneDeep(initialConfig),
      path: ["paths", "0", "visible"],
      value: BasicBuilder.boolean(),
    };

    handleUpdateAction(input);

    expect(input.draft.paths[0]).toEqual({ ...DEFAULT_PLOT_PATH, enabled: input.value });
  });

  it("should update legend", () => {
    const initialConfig = PlotBuilder.config({
      paths: [],
      showLegend: false,
    });
    const input: HandleUpdateAction = {
      draft: _.cloneDeep(initialConfig),
      path: ["legend", "legendDisplay"],
      value: BasicBuilder.string(),
    };

    handleUpdateAction(input);

    expect(input.draft.legendDisplay).toBe(input.value);
    expect(input.draft.showLegend).toBe(true);
  });

  it("should update xAxisPath", () => {
    const initialConfig = PlotBuilder.config({ paths: [] });
    const input: HandleUpdateAction = {
      draft: _.cloneDeep(initialConfig),
      path: ["xAxis", "xAxisPath"],
      value: BasicBuilder.string(),
    };

    handleUpdateAction(input);

    expect(input.draft.xAxisPath).toEqual(
      expect.objectContaining({
        value: input.value,
      }),
    );
  });

  it("should update minXValue and maxXValue to undefined", () => {
    const initialConfig = PlotBuilder.config({ paths: [] });
    const input: HandleUpdateAction = {
      draft: _.cloneDeep(initialConfig),
      path: [BasicBuilder.string(), "followingViewWidth"],
      value: BasicBuilder.string(),
    };

    handleUpdateAction(input);

    expect(input.draft.minXValue).toBeUndefined();
    expect(input.draft.maxXValue).toBeUndefined();
  });

  it.each(["minXValue", "maxXValue"])(
    "should update followingViewWidth when path is minXValue or maxXValue",
    (path1) => {
      const initialConfig = PlotBuilder.config({ paths: [] });
      const input: HandleUpdateAction = {
        draft: _.cloneDeep(initialConfig),
        path: [BasicBuilder.string(), path1],
        value: BasicBuilder.string(),
      };

      handleUpdateAction(input);

      expect(input.draft.followingViewWidth).toBeUndefined();
    },
  );
});

describe("handleAddSeriesAction", () => {
  it.each([{ paths: PlotBuilder.paths() }, { paths: [] }])("should add series", ({ paths }) => {
    const initialConfig = PlotBuilder.config({ paths });
    const input: HandleAction = {
      draft: _.cloneDeep(initialConfig),
    };

    handleAddSeriesAction(input);

    expect(input.draft.paths).toContainEqual(DEFAULT_PLOT_PATH);
  });
});

describe("handleDeleteSeriesAction", () => {
  it("should delete a serie", () => {
    const initialConfig = PlotBuilder.config();
    const input: HandleDeleteSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index: 1,
    };

    handleDeleteSeriesAction(input);

    expect(input.draft.paths.length).toBe(initialConfig.paths.length - 1);
  });
});

describe("handleMoveSeriesAction", () => {
  it.each<{
    description: string;
    index: number;
    direction: "up" | "down";
    expectedOrder: number[];
    pathCount: number;
  }>([
    // Standard moves
    {
      description: "move series up from middle position",
      index: 1,
      direction: "up",
      expectedOrder: [1, 0, 2],
      pathCount: 3,
    },
    {
      description: "move series down from middle position",
      index: 1,
      direction: "down",
      expectedOrder: [0, 2, 1],
      pathCount: 3,
    },
    // Edge cases - no movement expected
    {
      description: "not move series up when already at top",
      index: 0,
      direction: "up",
      expectedOrder: [0, 1, 2],
      pathCount: 3,
    },
    {
      description: "not move series down when already at bottom",
      index: 2,
      direction: "down",
      expectedOrder: [0, 1, 2],
      pathCount: 3,
    },
    // Boundary moves
    {
      description: "move series down from top position",
      index: 0,
      direction: "down",
      expectedOrder: [1, 0, 2],
      pathCount: 3,
    },
    {
      description: "move series up from bottom position",
      index: 2,
      direction: "up",
      expectedOrder: [0, 2, 1],
      pathCount: 3,
    },
    // Minimum series edge case
    {
      description: "swap two series when moving down",
      index: 0,
      direction: "down",
      expectedOrder: [1, 0],
      pathCount: 2,
    },
    {
      description: "swap two series when moving up",
      index: 1,
      direction: "up",
      expectedOrder: [1, 0],
      pathCount: 2,
    },
  ])("should $description", ({ index, direction, expectedOrder, pathCount }) => {
    // Given: A configuration with the specified number of series
    const paths = PlotBuilder.paths(pathCount);
    const initialConfig = PlotBuilder.config({ paths });
    const input: HandleMoveSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index,
      direction,
    };

    // When: Moving the series
    handleMoveSeriesAction(input);

    // Then: The order should match expected
    expect(input.draft.paths).toHaveLength(pathCount);
    expectedOrder.forEach((originalIndex, newIndex) => {
      expect(input.draft.paths[newIndex]).toEqual(paths[originalIndex]);
    });
  });
});

describe("usePlotPanelSettings", () => {
  const saveConfig = jest.fn();
  const updatePanelSettingsTree = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    (usePanelSettingsTreeUpdate as jest.Mock).mockReturnValue(updatePanelSettingsTree);
  });

  it.each([
    {
      action: "update",
      payload: { path: [], value: "", input: "string" },
    } as SettingsTreeActionUpdate,
    {
      action: "perform-node-action",
      payload: { path: [], id: "add-series" },
    } as SettingsTreeActionPerformNode,
    {
      action: "perform-node-action",
      payload: { path: [], id: "delete-series" },
    } as SettingsTreeActionPerformNode,
  ])("should call saveConfig to update settings tree", (action: SettingsTreeAction) => {
    const config = PlotBuilder.config();
    const focusedPath = undefined;

    renderHook(() => {
      usePlotPanelSettings(config, saveConfig, focusedPath);
    });

    expect(usePanelSettingsTreeUpdate).toHaveBeenCalled();

    const actionHandler = updatePanelSettingsTree.mock.calls[0][0].actionHandler;
    act(() => {
      actionHandler(action);
    });

    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
  });

  describe("move-series actions", () => {
    it.each<{ actionId: string; direction: "up" | "down" }>([
      { actionId: "move-series-up", direction: "up" },
      { actionId: "move-series-down", direction: "down" },
    ])("should call saveConfig when $actionId action is triggered", ({ actionId }) => {
      // Given: A configuration with three series
      const config = PlotBuilder.config();

      renderHook(() => {
        usePlotPanelSettings(config, saveConfig, undefined);
      });

      const actionHandler = updatePanelSettingsTree.mock.calls[0][0].actionHandler;

      // When: Triggering move action for index 1
      const action: SettingsTreeActionPerformNode = {
        action: "perform-node-action",
        payload: { path: ["paths", "1"], id: actionId },
      };

      act(() => {
        actionHandler(action);
      });

      // Then: saveConfig should be called with the producer function
      expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("reorder-node action (drag and drop)", () => {
    it.each([
      { sourceIndex: 0, targetIndex: 2, description: "first to last" },
      { sourceIndex: 2, targetIndex: 0, description: "last to first" },
      { sourceIndex: 0, targetIndex: 1, description: "first to middle" },
      { sourceIndex: 1, targetIndex: 2, description: "middle to last" },
    ])(
      "should call saveConfig with reorder action when moving $description",
      ({ sourceIndex, targetIndex }) => {
        // Given: A configuration with three series
        const config = PlotBuilder.config();

        renderHook(() => {
          usePlotPanelSettings(config, saveConfig, undefined);
        });

        const actionHandler = updatePanelSettingsTree.mock.calls[0][0].actionHandler;

        // When: Triggering reorder-node action
        const action: SettingsTreeActionReorder = {
          action: "reorder-node",
          payload: {
            path: ["paths", String(sourceIndex)],
            targetPath: ["paths", String(targetIndex)],
          },
        };

        act(() => {
          actionHandler(action);
        });

        // Then: saveConfig should be called with the producer function
        expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
      },
    );
  });
});
