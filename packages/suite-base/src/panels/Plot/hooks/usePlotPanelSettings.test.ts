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
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import PlotBuilder from "@lichtblick/suite-base/testing/builders/PlotBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import usePlotPanelSettings, {
  HandleAction,
  handleAddSeriesAction,
  HandleDeleteSeriesAction,
  handleDeleteSeriesAction,
  HandleUpdateAction,
  handleUpdateAction,
} from "./usePlotPanelSettings";

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
});
