// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { Datum, HoverElement } from "@lichtblick/suite-base/panels/Plot/types";
import {
  BasePlotPath,
  PlotConfig,
  PlotPath,
  PlotXAxisVal,
} from "@lichtblick/suite-base/panels/Plot/utils/config";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";
import { TimestampMethod } from "@lichtblick/suite-base/util/time";

export default class PlotBuilder {
  public static datum(props: Partial<Datum> = {}): Datum {
    return defaults<Datum>(props, {
      x: BasicBuilder.number(),
      y: BasicBuilder.number(),
      value: undefined,
    });
  }

  public static hoverElement(props: Partial<HoverElement> = {}): HoverElement {
    return defaults<HoverElement>(props, {
      configIndex: BasicBuilder.number(),
      data: PlotBuilder.datum(),
    });
  }

  public static hoverElements(count = 3): HoverElement[] {
    return BasicBuilder.multiple(PlotBuilder.hoverElement, count);
  }

  public static path(props: Partial<PlotPath> = {}): PlotPath {
    return defaults<PlotPath>(props, {
      enabled: BasicBuilder.boolean(),
      timestampMethod: BasicBuilder.sample(["headerStamp", "receiveTime"] as TimestampMethod[]),
      value: BasicBuilder.string(),
    });
  }

  public static paths(count = 3): PlotPath[] {
    return BasicBuilder.multiple(PlotBuilder.path, count);
  }

  public static basePlotPath(props: Partial<BasePlotPath> = {}): BasePlotPath {
    return defaults<BasePlotPath>(props, {
      value: BasicBuilder.string(),
      enabled: BasicBuilder.boolean(),
    });
  }

  public static config(props: Partial<PlotConfig> = {}): PlotConfig {
    return defaults<PlotConfig>(props, {
      followingViewWidth: BasicBuilder.number(),
      lichtblickPanelTitle: BasicBuilder.string(),
      isSynced: BasicBuilder.boolean(),
      legendDisplay: "floating",
      maxXValue: BasicBuilder.number(),
      maxYValue: BasicBuilder.number(),
      minXValue: BasicBuilder.number(),
      minYValue: BasicBuilder.number(),
      paths: PlotBuilder.paths(),
      showLegend: BasicBuilder.boolean(),
      showPlotValuesInLegend: BasicBuilder.boolean(),
      showSidebar: BasicBuilder.boolean(),
      showXAxisLabels: BasicBuilder.boolean(),
      showYAxisLabels: BasicBuilder.boolean(),
      sidebarDimension: BasicBuilder.number(),
      sidebarWidth: BasicBuilder.number(),
      xAxisPath: PlotBuilder.basePlotPath(),
      xAxisVal: BasicBuilder.sample([
        "timestamp",
        "index",
        "custom",
        "currentCustom",
      ] as PlotXAxisVal[]),
    });
  }
}
