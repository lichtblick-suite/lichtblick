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

  beforeEach(() => {
    // t = jest.fn((key) => key);
  });

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
});
