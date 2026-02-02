/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import * as _ from "lodash-es";

import {
  SettingsTreeAction,
  SettingsTreeActionPerformNode,
  SettingsTreeActionUpdate,
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

describe("given-when-then: handleMoveSeriesAction", () => {
  it("should move series up from middle position", () => {
    // Given: A configuration with three series
    const path1 = PlotBuilder.path();
    const path2 = PlotBuilder.path();
    const path3 = PlotBuilder.path();
    const initialConfig = PlotBuilder.config({
      paths: [path1, path2, path3],
    });
    const input: HandleMoveSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index: 1,
      direction: "up",
    };

    // When: Moving the middle series up
    handleMoveSeriesAction(input);

    // Then: The series should be swapped with the one above
    expect(input.draft.paths).toHaveLength(3);
    expect(input.draft.paths[0]).toEqual(path2);
    expect(input.draft.paths[1]).toEqual(path1);
    expect(input.draft.paths[2]).toEqual(path3);
  });

  it("should move series down from middle position", () => {
    // Given: A configuration with three series
    const path1 = PlotBuilder.path();
    const path2 = PlotBuilder.path();
    const path3 = PlotBuilder.path();
    const initialConfig = PlotBuilder.config({
      paths: [path1, path2, path3],
    });
    const input: HandleMoveSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index: 1,
      direction: "down",
    };

    // When: Moving the middle series down
    handleMoveSeriesAction(input);

    // Then: The series should be swapped with the one below
    expect(input.draft.paths).toHaveLength(3);
    expect(input.draft.paths[0]).toEqual(path1);
    expect(input.draft.paths[1]).toEqual(path3);
    expect(input.draft.paths[2]).toEqual(path2);
  });

  it("should not move series up when already at top position", () => {
    // Given: A configuration with three series
    const path1 = PlotBuilder.path();
    const path2 = PlotBuilder.path();
    const path3 = PlotBuilder.path();
    const initialConfig = PlotBuilder.config({
      paths: [path1, path2, path3],
    });
    const input: HandleMoveSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index: 0,
      direction: "up",
    };

    // When: Attempting to move the first series up
    handleMoveSeriesAction(input);

    // Then: The order should remain unchanged
    expect(input.draft.paths).toHaveLength(3);
    expect(input.draft.paths[0]).toEqual(path1);
    expect(input.draft.paths[1]).toEqual(path2);
    expect(input.draft.paths[2]).toEqual(path3);
  });

  it("should not move series down when already at bottom position", () => {
    // Given: A configuration with three series
    const path1 = PlotBuilder.path();
    const path2 = PlotBuilder.path();
    const path3 = PlotBuilder.path();
    const initialConfig = PlotBuilder.config({
      paths: [path1, path2, path3],
    });
    const input: HandleMoveSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index: 2,
      direction: "down",
    };

    // When: Attempting to move the last series down
    handleMoveSeriesAction(input);

    // Then: The order should remain unchanged
    expect(input.draft.paths).toHaveLength(3);
    expect(input.draft.paths[0]).toEqual(path1);
    expect(input.draft.paths[1]).toEqual(path2);
    expect(input.draft.paths[2]).toEqual(path3);
  });

  it("should move series up from bottom position", () => {
    // Given: A configuration with four series
    const path1 = PlotBuilder.path();
    const path2 = PlotBuilder.path();
    const path3 = PlotBuilder.path();
    const path4 = PlotBuilder.path();
    const initialConfig = PlotBuilder.config({
      paths: [path1, path2, path3, path4],
    });
    const input: HandleMoveSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index: 3,
      direction: "up",
    };

    // When: Moving the last series up
    handleMoveSeriesAction(input);

    // Then: The series should be swapped with the one above
    expect(input.draft.paths).toHaveLength(4);
    expect(input.draft.paths[0]).toEqual(path1);
    expect(input.draft.paths[1]).toEqual(path2);
    expect(input.draft.paths[2]).toEqual(path4);
    expect(input.draft.paths[3]).toEqual(path3);
  });

  it("should move series down from top position", () => {
    // Given: A configuration with four series
    const path1 = PlotBuilder.path();
    const path2 = PlotBuilder.path();
    const path3 = PlotBuilder.path();
    const path4 = PlotBuilder.path();
    const initialConfig = PlotBuilder.config({
      paths: [path1, path2, path3, path4],
    });
    const input: HandleMoveSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index: 0,
      direction: "down",
    };

    // When: Moving the first series down
    handleMoveSeriesAction(input);

    // Then: The series should be swapped with the one below
    expect(input.draft.paths).toHaveLength(4);
    expect(input.draft.paths[0]).toEqual(path2);
    expect(input.draft.paths[1]).toEqual(path1);
    expect(input.draft.paths[2]).toEqual(path3);
    expect(input.draft.paths[3]).toEqual(path4);
  });

  it("should handle moving with minimum two series", () => {
    // Given: A configuration with exactly two series
    const path1 = PlotBuilder.path();
    const path2 = PlotBuilder.path();
    const initialConfig = PlotBuilder.config({
      paths: [path1, path2],
    });
    const input: HandleMoveSeriesAction = {
      draft: _.cloneDeep(initialConfig),
      index: 0,
      direction: "down",
    };

    // When: Moving the first series down
    handleMoveSeriesAction(input);

    // Then: The two series should be swapped
    expect(input.draft.paths).toHaveLength(2);
    expect(input.draft.paths[0]).toEqual(path2);
    expect(input.draft.paths[1]).toEqual(path1);
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

  describe("given-when-then: move-series actions", () => {
    it("should move series up when move-series-up action is triggered", () => {
      // Given: A configuration with three series
      const path1 = PlotBuilder.path();
      const path2 = PlotBuilder.path();
      const path3 = PlotBuilder.path();
      const config = PlotBuilder.config({
        paths: [path1, path2, path3],
      });

      renderHook(() => {
        usePlotPanelSettings(config, saveConfig, undefined);
      });

      const actionHandler = updatePanelSettingsTree.mock.calls[0][0].actionHandler;

      // When: Triggering move-series-up for index 1
      const action: SettingsTreeActionPerformNode = {
        action: "perform-node-action",
        payload: { path: ["paths", "1"], id: "move-series-up" },
      };

      act(() => {
        actionHandler(action);
      });

      // Then: saveConfig should be called with the producer function
      expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should move series down when move-series-down action is triggered", () => {
      // Given: A configuration with three series
      const path1 = PlotBuilder.path();
      const path2 = PlotBuilder.path();
      const path3 = PlotBuilder.path();
      const config = PlotBuilder.config({
        paths: [path1, path2, path3],
      });

      renderHook(() => {
        usePlotPanelSettings(config, saveConfig, undefined);
      });

      const actionHandler = updatePanelSettingsTree.mock.calls[0][0].actionHandler;

      // When: Triggering move-series-down for index 1
      const action: SettingsTreeActionPerformNode = {
        action: "perform-node-action",
        payload: { path: ["paths", "1"], id: "move-series-down" },
      };

      act(() => {
        actionHandler(action);
      });

      // Then: saveConfig should be called with the producer function
      expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
