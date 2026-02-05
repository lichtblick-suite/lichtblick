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

  beforeEach(() => {});

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

  describe("makeSeriesNode - reorderable and icon properties", () => {
    it("should set reorderable to true and icon to DragHandle when canReorder is true", () => {
      // Given: A config with multiple paths where nodes should be reorderable
      const paths = [PlotBuilder.path(), PlotBuilder.path()];
      const config: PlotConfig = PlotBuilder.config({ paths });

      // When: Building the settings tree
      const tree = buildSettingsTree(config, t);

      // Then: Series nodes should have reorderable=true and icon=DragHandle
      const child0 = tree.paths?.children!["0"];
      const child1 = tree.paths?.children!["1"];
      expect(child0?.reorderable).toBe(true);
      expect(child0?.icon).toBe("DragHandle");
      expect(child1?.reorderable).toBe(true);
      expect(child1?.icon).toBe("DragHandle");
    });

    it("should set reorderable to false and icon to undefined when canReorder is false", () => {
      // Given: A config with no paths, which creates a default node
      const config: PlotConfig = PlotBuilder.config({ paths: [] });

      // When: Building the settings tree
      const tree = buildSettingsTree(config, t);

      // Then: Default series node should have reorderable=false and icon=undefined
      const child0 = tree.paths?.children!["0"];
      expect(child0?.reorderable).toBe(false);
      expect(child0?.icon).toBeUndefined();
    });

    it("should set reorderable to true and icon to DragHandle for all nodes when paths have multiple items", () => {
      // Given: A config with three paths
      const paths = [PlotBuilder.path(), PlotBuilder.path(), PlotBuilder.path()];
      const config: PlotConfig = PlotBuilder.config({ paths });

      // When: Building the settings tree
      const tree = buildSettingsTree(config, t);

      // Then: All series nodes should be reorderable with DragHandle icon
      const child0 = tree.paths?.children!["0"];
      const child1 = tree.paths?.children!["1"];
      const child2 = tree.paths?.children!["2"];
      expect(child0?.reorderable).toBe(true);
      expect(child0?.icon).toBe("DragHandle");
      expect(child1?.reorderable).toBe(true);
      expect(child1?.icon).toBe("DragHandle");
      expect(child2?.reorderable).toBe(true);
      expect(child2?.icon).toBe("DragHandle");
    });
  });

  describe("makeRootSeriesNode - children creation logic", () => {
    it("should create a single default child node with canDelete=false and canReorder=false when paths is empty", () => {
      // Given: A config with empty paths array
      const config: PlotConfig = PlotBuilder.config({ paths: [] });

      // When: Building the settings tree
      const tree = buildSettingsTree(config, t);

      // Then: Should have exactly one child with key "0"
      const children = tree.paths?.children;
      expect(Object.keys(children!).length).toBe(1);
      expect(children!["0"]).toBeDefined();

      // And: The child should use DEFAULT_PLOT_PATH properties
      const child0 = children!["0"];
      expect(child0?.fields?.value?.value).toBe(DEFAULT_PLOT_PATH.value);
      expect(child0?.visible).toBe(DEFAULT_PLOT_PATH.enabled);

      // And: The child should not be deletable or reorderable
      expect(child0?.actions?.length).toBe(0);
      expect(child0?.reorderable).toBe(false);
      expect(child0?.icon).toBeUndefined();
    });

    it("should create multiple children with canDelete=true and canReorder=true when paths has items", () => {
      // Given: A config with multiple paths
      const path1 = PlotBuilder.path({
        value: BasicBuilder.string(),
        label: BasicBuilder.string(),
      });
      const path2 = PlotBuilder.path({
        value: BasicBuilder.string(),
        label: BasicBuilder.string(),
      });
      const config: PlotConfig = PlotBuilder.config({ paths: [path1, path2] });

      // When: Building the settings tree
      const tree = buildSettingsTree(config, t);

      // Then: Should have children with keys matching path indices
      const children = tree.paths?.children;
      expect(Object.keys(children!).length).toBe(2);
      expect(children!["0"]).toBeDefined();
      expect(children!["1"]).toBeDefined();

      // And: Each child should be deletable and reorderable
      const child0 = children!["0"];
      const child1 = children!["1"];
      expect(child0?.actions?.length).toBe(1);
      expect((child0?.actions![0] as SettingsTreeNodeActionItem).id).toBe("delete-series");
      expect(child0?.reorderable).toBe(true);
      expect(child0?.icon).toBe("DragHandle");
      expect(child1?.actions?.length).toBe(1);
      expect((child1?.actions![0] as SettingsTreeNodeActionItem).id).toBe("delete-series");
      expect(child1?.reorderable).toBe(true);
      expect(child1?.icon).toBe("DragHandle");
    });

    it("should map paths to children with correct indices as keys", () => {
      // Given: A config with four paths
      const paths = [
        PlotBuilder.path({ value: "/topic1" }),
        PlotBuilder.path({ value: "/topic2" }),
        PlotBuilder.path({ value: "/topic3" }),
        PlotBuilder.path({ value: "/topic4" }),
      ];
      const config: PlotConfig = PlotBuilder.config({ paths });

      // When: Building the settings tree
      const tree = buildSettingsTree(config, t);

      // Then: Children keys should be "0", "1", "2", "3"
      const children = tree.paths?.children;
      expect(Object.keys(children!)).toEqual(["0", "1", "2", "3"]);

      // And: Each child should correspond to the correct path
      expect(children!["0"]?.fields?.value?.value).toBe(paths[0]?.value);
      expect(children!["1"]?.fields?.value?.value).toBe(paths[1]?.value);
      expect(children!["2"]?.fields?.value?.value).toBe(paths[2]?.value);
      expect(children!["3"]?.fields?.value?.value).toBe(paths[3]?.value);
    });

    it("should handle single path by creating one child with canDelete=true and canReorder=true", () => {
      // Given: A config with exactly one path
      const path = PlotBuilder.path({
        value: BasicBuilder.string(),
        label: BasicBuilder.string(),
      });
      const config: PlotConfig = PlotBuilder.config({ paths: [path] });

      // When: Building the settings tree
      const tree = buildSettingsTree(config, t);

      // Then: Should have exactly one child with key "0"
      const children = tree.paths?.children;
      expect(Object.keys(children!).length).toBe(1);
      expect(children!["0"]).toBeDefined();

      // And: The child should be deletable and reorderable
      const child0 = children!["0"];
      expect(child0?.actions?.length).toBe(1);
      expect((child0?.actions![0] as SettingsTreeNodeActionItem).id).toBe("delete-series");
      expect(child0?.reorderable).toBe(true);
      expect(child0?.icon).toBe("DragHandle");
    });
  });
});
