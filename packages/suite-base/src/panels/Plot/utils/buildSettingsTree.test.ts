// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { TFunction } from "i18next";

import { SettingsTreeNode, SettingsTreeNodeActionItem } from "@lichtblick/suite";
import { DEFAULT_PLOT_PATH } from "@lichtblick/suite-base/panels/Plot/constants";
import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import { PLOTABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/shared/constants";
import PlotBuilder from "@lichtblick/suite-base/testing/builders/PlotBuilder";
import { lineColors } from "@lichtblick/suite-base/util/plotColors";
import { BasicBuilder } from "@lichtblick/test-builders";

import { buildSettingsTree } from "./buildSettingsTree";

describe("buildSettingsTree", () => {
  const t: TFunction<"plot"> = jest.fn((key) => key) as unknown as TFunction<"plot">;

  it("should build the settings tree", () => {
    const paths = [
      PlotBuilder.path({
        color: BasicBuilder.string(),
        label: BasicBuilder.string(),
        showLine: BasicBuilder.boolean(),
        lineSize: BasicBuilder.number(),
      }),
      PlotBuilder.path(),
    ];
    const config: PlotConfig = PlotBuilder.config({ paths });

    const tree = buildSettingsTree(config, t);

    expect(tree.general?.fields?.isSynced?.value).toBe(config.isSynced);
    expect(tree.legend?.fields?.legendDisplay?.value).toBe(config.legendDisplay);
    expect(tree.yAxis?.fields?.minYValue?.value).toBe(config.minYValue);
    expect(tree.yAxis?.fields?.maxYValue?.value).toBe(config.maxYValue);
    expect(tree.xAxis?.fields?.minXValue?.value).toBe(config.minXValue);
    expect(tree.xAxis?.fields?.maxXValue?.value).toBe(config.maxXValue);

    // paths
    expect(Object.keys(tree.paths!.children!).length).toBe(paths.length);
    // paths.actions
    expect(tree.paths!.actions!.length).toBe(1);
    expect((tree.paths!.actions![0] as SettingsTreeNodeActionItem).id).toEqual("add-series");
    // paths.children[0]
    const children0: SettingsTreeNode | undefined = tree.paths?.children!["0"];
    expect(children0?.visible).toBe(config.paths[0]?.enabled);
    expect(children0?.label).toBe(config.paths[0]?.label);
    expect(children0?.reorderable).toBe(true);
    expect(children0?.icon).toBe("DragHandle");
    expect(children0?.actions?.length).toBe(1);
    expect((children0?.actions![0] as SettingsTreeNodeActionItem).id).toEqual("delete-series");
    expect(children0?.fields!["value"]).toBeDefined();
    expect(children0?.fields!["label"]).toBeDefined();
    expect(children0?.fields!["color"]).toBeDefined();
    expect(children0?.fields!["lineSize"]).toBeDefined();
    expect(children0?.fields!["showLine"]).toBeDefined();
    expect(children0?.fields!["timestampMethod"]).toBeDefined();
    expect(children0?.fields!["value"]).toEqual(
      expect.objectContaining({
        supportsMathModifiers: true,
        validTypes: PLOTABLE_ROS_TYPES,
        value: config.paths[0]?.value,
      }),
    );
    expect(children0?.fields!["label"]).toEqual(
      expect.objectContaining({
        value: config.paths[0]?.label,
      }),
    );
    expect(children0?.fields!["color"]).toEqual(
      expect.objectContaining({
        value: config.paths[0]?.color,
      }),
    );
    expect(children0?.fields!["lineSize"]).toEqual(
      expect.objectContaining({ value: config.paths[0]?.lineSize }),
    );
    expect(children0?.fields!["showLine"]).toEqual(
      expect.objectContaining({ value: config.paths[0]?.showLine }),
    );
    expect(children0?.fields!["timestampMethod"]).toEqual(
      expect.objectContaining({ value: config.paths[0]?.timestampMethod }),
    );

    // paths.children[1]
    const children1: SettingsTreeNode | undefined = tree.paths?.children!["1"];
    expect(children1?.fields!["showLine"]).toEqual(expect.objectContaining({ value: true }));
    expect(children1?.fields!["color"]).toEqual(
      expect.objectContaining({ value: lineColors[1 % lineColors.length] }),
    );
  });

  it("should add a default plot path in the node when no paths", () => {
    const config: PlotConfig = PlotBuilder.config({ paths: [] });

    const tree = buildSettingsTree(config, t);

    expect(tree.paths?.children!["0"]?.fields?.value?.value).toBe(DEFAULT_PLOT_PATH.value);
  });

  it("should set an error when maxYValue is less than or equal to minYValue", () => {
    const config: PlotConfig = PlotBuilder.config({
      maxXValue: 100,
      maxYValue: 5,
      minXValue: 0,
      minYValue: 10,
      paths: [],
    });

    const tree = buildSettingsTree(config, t);
    expect(tree.yAxis?.fields?.maxYValue?.error).toBe("maxYError");
  });

  it("should set an error when maxXValue is less than or equal to minXValue", () => {
    const config: PlotConfig = PlotBuilder.config({
      maxXValue: 50,
      maxYValue: 10,
      minXValue: 100,
      minYValue: 0,
      paths: [],
    });

    const tree = buildSettingsTree(config, t);
    expect(tree.xAxis?.fields?.maxXValue?.error).toBe("maxXError");
  });

  it("should include legend settings with all options", () => {
    // Given - config with specific legend display
    const config: PlotConfig = PlotBuilder.config({
      legendDisplay: "floating",
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - legend field should have all display options
    expect(tree.legend?.fields?.legendDisplay).toBeDefined();
    const legendField = tree.legend?.fields?.legendDisplay;
    expect(legendField?.input).toBe("select");
    // Type assertion after checking input type
    const selectField = legendField as {
      input: "select";
      options: { value: string; label: string }[];
    };
    expect(selectField.options).toEqual([
      { value: "floating", label: "floating" },
      { value: "left", label: "left" },
      { value: "top", label: "top" },
      { value: "none", label: "hidden" },
    ]);
  });

  it("should include showPlotValuesInLegend field", () => {
    // Given - config with showPlotValuesInLegend
    const config: PlotConfig = PlotBuilder.config({
      showPlotValuesInLegend: true,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - showPlotValuesInLegend field should be present
    expect(tree.legend?.fields?.showPlotValuesInLegend).toEqual({
      label: "showValues",
      input: "boolean",
      value: true,
    });
  });

  it("should include showYAxisLabels field", () => {
    // Given - config with showYAxisLabels
    const config: PlotConfig = PlotBuilder.config({
      showYAxisLabels: false,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - showYAxisLabels field should be present
    expect(tree.yAxis?.fields?.showYAxisLabels).toEqual({
      label: "showLabels",
      input: "boolean",
      value: false,
    });
  });

  it("should include xAxis fields with xAxisVal options", () => {
    // Given - config with xAxisVal set to custom
    const config: PlotConfig = PlotBuilder.config({
      xAxisVal: "custom",
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - xAxisVal field should have all options
    const xAxisValField = tree.xAxis?.fields?.xAxisVal;
    expect(xAxisValField?.input).toBe("select");
    // Type assertion after checking input type
    const selectField = xAxisValField as {
      input: "select";
      options: { label: string; value: string }[];
    };
    expect(selectField.options).toEqual([
      { label: "timestamp", value: "timestamp" },
      { label: "index", value: "index" },
      { label: "currentPath", value: "currentCustom" },
      { label: "accumulatedPath", value: "custom" },
    ]);
  });

  it("should include xAxisPath field when xAxisVal is currentCustom", () => {
    // Given - config with xAxisVal set to currentCustom
    const xAxisPath = { value: BasicBuilder.string(), enabled: true };
    const config: PlotConfig = PlotBuilder.config({
      xAxisVal: "currentCustom",
      xAxisPath,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - xAxisPath field should be present
    expect(tree.xAxis?.fields?.xAxisPath).toBeDefined();
    expect(tree.xAxis?.fields?.xAxisPath?.value).toBe(xAxisPath.value);
  });

  it("should include xAxisPath field when xAxisVal is custom", () => {
    // Given - config with xAxisVal set to custom
    const xAxisPath = { value: BasicBuilder.string(), enabled: true };
    const config: PlotConfig = PlotBuilder.config({
      xAxisVal: "custom",
      xAxisPath,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - xAxisPath field should be present
    expect(tree.xAxis?.fields?.xAxisPath).toBeDefined();
  });

  it("should not include xAxisPath field when xAxisVal is timestamp", () => {
    // Given - config with xAxisVal set to timestamp
    const config: PlotConfig = PlotBuilder.config({
      xAxisVal: "timestamp",
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - xAxisPath field should not be present
    expect(tree.xAxis?.fields?.xAxisPath).toBeUndefined();
  });

  it("should include showXAxisLabels field", () => {
    // Given - config with showXAxisLabels
    const config: PlotConfig = PlotBuilder.config({
      showXAxisLabels: true,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - showXAxisLabels field should be present
    expect(tree.xAxis?.fields?.showXAxisLabels).toEqual({
      label: "showLabels",
      input: "boolean",
      value: true,
    });
  });

  it("should include followingViewWidth field", () => {
    // Given - config with followingViewWidth
    const followingViewWidth = BasicBuilder.number({ min: 1, max: 100 });
    const config: PlotConfig = PlotBuilder.config({
      followingViewWidth,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - followingViewWidth field should be present
    expect(tree.xAxis?.fields?.followingViewWidth).toEqual({
      label: "secondsRange",
      input: "number",
      placeholder: "auto",
      value: followingViewWidth,
    });
  });

  it("should handle path with all fields defined", () => {
    // Given - config with fully defined path
    const path = PlotBuilder.path({
      value: BasicBuilder.string(),
      label: BasicBuilder.string(),
      enabled: true,
      color: BasicBuilder.string(),
      lineSize: BasicBuilder.number({ min: 0, max: 5 }),
      showLine: true,
      timestampMethod: "headerStamp",
    });
    const config: PlotConfig = PlotBuilder.config({ paths: [path] });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - path should have all fields
    const pathNode = tree.paths?.children?.["0"];
    expect(pathNode?.fields?.value).toBeDefined();
    expect(pathNode?.fields?.label?.value).toBe(path.label);
    expect(pathNode?.fields?.color?.value).toBe(path.color);
    expect(pathNode?.fields?.lineSize?.value).toBe(path.lineSize);
    expect(pathNode?.fields?.showLine?.value).toBe(true);
    expect(pathNode?.fields?.timestampMethod?.value).toBe("headerStamp");
  });

  it("should use default line color when path color is undefined", () => {
    // Given - config with path without color
    const path = PlotBuilder.path({ color: undefined });
    const config: PlotConfig = PlotBuilder.config({ paths: [path] });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - should use default color from lineColors
    const pathNode = tree.paths?.children?.["0"];
    expect(pathNode?.fields?.color?.value).toBeDefined();
  });

  it("should set yAxis defaultExpansionState to collapsed", () => {
    // Given - any config
    const config: PlotConfig = PlotBuilder.config({ paths: [] });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - yAxis should have defaultExpansionState collapsed
    expect(tree.yAxis?.defaultExpansionState).toBe("collapsed");
  });

  it("should set xAxis defaultExpansionState to collapsed", () => {
    // Given - any config
    const config: PlotConfig = PlotBuilder.config({ paths: [] });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - xAxis should have defaultExpansionState collapsed
    expect(tree.xAxis?.defaultExpansionState).toBe("collapsed");
  });

  it("should include delete-series action for paths", () => {
    // Given - config with a path
    const path = PlotBuilder.path();
    const config: PlotConfig = PlotBuilder.config({ paths: [path] });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - path node should have delete action
    const pathNode = tree.paths?.children?.["0"];
    expect(pathNode?.actions).toContainEqual({
      type: "action",
      id: "delete-series",
      label: "deleteSeries",
      display: "inline",
      icon: "Clear",
    });
  });

  it("should mark path as reorderable", () => {
    // Given - config with a path
    const path = PlotBuilder.path();
    const config: PlotConfig = PlotBuilder.config({ paths: [path] });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - path node should be reorderable
    const pathNode = tree.paths?.children?.["0"];
    expect(pathNode?.reorderable).toBe(true);
    expect(pathNode?.icon).toBe("DragHandle");
  });

  it("should not set error when minYValue and maxYValue are valid", () => {
    // Given - config with valid Y values
    const config: PlotConfig = PlotBuilder.config({
      minYValue: 0,
      maxYValue: 100,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - should not have error
    expect(tree.yAxis?.fields?.maxYValue?.error).toBeUndefined();
  });

  it("should not set error when minXValue and maxXValue are valid", () => {
    // Given - config with valid X values
    const config: PlotConfig = PlotBuilder.config({
      minXValue: 0,
      maxXValue: 100,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - should not have error
    expect(tree.xAxis?.fields?.maxXValue?.error).toBeUndefined();
  });

  it("should handle empty xAxisPath value", () => {
    // Given - config with empty xAxisPath
    const config: PlotConfig = PlotBuilder.config({
      xAxisVal: "custom",
      xAxisPath: { value: "", enabled: true },
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - xAxisPath should have empty value
    expect(tree.xAxis?.fields?.xAxisPath?.value).toBe("");
  });

  it("should handle undefined xAxisPath", () => {
    // Given - config with undefined xAxisPath but xAxisVal set to custom
    const config: PlotConfig = PlotBuilder.config({
      xAxisVal: "custom",
      xAxisPath: undefined,
      paths: [],
    });

    // When - building settings tree
    const tree = buildSettingsTree(config, t);

    // Then - xAxisPath field should be present (it uses optional chaining with empty string default)
    expect(tree.xAxis?.fields?.xAxisPath).toBeDefined();
    // The value will actually be from PlotBuilder.config defaults if xAxisPath is undefined
    expect(tree.xAxis?.fields?.xAxisPath?.value).toBeDefined();
  });
});
