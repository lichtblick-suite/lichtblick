// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TFunction } from "i18next";
import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";

import { SettingsTreeNode, SettingsTreeNodes } from "@lichtblick/suite";
import { DEFAULT_PLOT_PATH } from "@lichtblick/suite-base/panels/Plot/constants";
import {
  PlotConfig,
  PlotPath,
  plotPathDisplayName,
} from "@lichtblick/suite-base/panels/Plot/utils/config";
import { PLOTABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/shared/constants";
import { lineColors } from "@lichtblick/suite-base/util/plotColors";

type MakeSeriesNode = {
  path: PlotPath;
  index: number;
  canDelete: boolean;
  t: TFunction<"plot">;
};

type MakeRootSeriesNode = {
  paths: PlotPath[];
  t: TFunction<"plot">;
};

const makeSeriesNode = memoizeWeak(
  ({ canDelete, index, path, t }: MakeSeriesNode): SettingsTreeNode => {
    return {
      actions: canDelete
        ? [
            {
              type: "action",
              id: "delete-series",
              label: t("deleteSeries"),
              display: "inline",
              icon: "Clear",
            },
          ]
        : [],
      label: plotPathDisplayName(path, index),
      visible: path.enabled,
      fields: {
        value: {
          input: "messagepath",
          label: t("messagePath"),
          supportsMathModifiers: true,
          validTypes: PLOTABLE_ROS_TYPES,
          value: path.value,
        },
        label: {
          input: "string",
          label: t("label"),
          value: path.label,
        },
        color: {
          input: "rgb",
          label: t("color"),
          value: path.color ?? lineColors[index % lineColors.length],
        },
        lineSize: {
          input: "number",
          label: t("lineSize"),
          value: path.lineSize,
          step: 0.2,
          min: 0,
          placeholder: "auto",
        },
        showLine: {
          input: "boolean",
          label: t("showLine"),
          value: path.showLine ?? true,
        },
        timestampMethod: {
          input: "select",
          label: t("timestamp"),
          options: [
            { label: t("receiveTime"), value: "receiveTime" },
            { label: t("headerStamp"), value: "headerStamp" },
          ],
          value: path.timestampMethod,
        },
      },
    };
  },
);

const makeRootSeriesNode = memoizeWeak(({ paths, t }: MakeRootSeriesNode): SettingsTreeNode => {
  const children = Object.fromEntries(
    paths.length === 0
      ? [["0", makeSeriesNode({ canDelete: false, path: DEFAULT_PLOT_PATH, index: 0, t })]]
      : paths.map((path, index) => [
          `${index}`,
          makeSeriesNode({ canDelete: true, index, path, t }),
        ]),
  );
  return {
    label: t("series"),
    children,
    actions: [
      {
        type: "action",
        id: "add-series",
        display: "inline",
        icon: "Addchart",
        label: t("addSeries"),
      },
    ],
  };
});

export function buildSettingsTree(config: PlotConfig, t: TFunction<"plot">): SettingsTreeNodes {
  const maxYError =
    _.isNumber(config.minYValue) &&
    _.isNumber(config.maxYValue) &&
    config.minYValue >= config.maxYValue
      ? t("maxYError")
      : undefined;

  const maxXError =
    _.isNumber(config.minXValue) &&
    _.isNumber(config.maxXValue) &&
    config.minXValue >= config.maxXValue
      ? t("maxXError")
      : undefined;

  return {
    general: {
      label: t("general"),
      fields: {
        isSynced: { label: t("syncWithOtherPlots"), input: "boolean", value: config.isSynced },
      },
    },
    legend: {
      label: t("legend"),
      fields: {
        legendDisplay: {
          label: t("position"),
          input: "select",
          value: config.legendDisplay,
          options: [
            { value: "floating", label: t("floating") },
            { value: "left", label: t("left") },
            { value: "top", label: t("top") },
            { value: "none", label: t("hidden") },
          ],
        },
        showPlotValuesInLegend: {
          label: t("showValues"),
          input: "boolean",
          value: config.showPlotValuesInLegend,
        },
      },
    },
    yAxis: {
      label: t("yAxis"),
      defaultExpansionState: "collapsed",
      fields: {
        showYAxisLabels: {
          label: t("showLabels"),
          input: "boolean",
          value: config.showYAxisLabels,
        },
        minYValue: {
          label: t("min"),
          input: "number",
          value: config.minYValue != undefined ? Number(config.minYValue) : undefined,
          placeholder: "auto",
        },
        maxYValue: {
          label: t("max"),
          input: "number",
          error: maxYError,
          value: config.maxYValue != undefined ? Number(config.maxYValue) : undefined,
          placeholder: "auto",
        },
      },
    },
    xAxis: {
      label: t("xAxis"),
      defaultExpansionState: "collapsed",
      fields: {
        xAxisVal: {
          label: t("value"),
          input: "select",
          value: config.xAxisVal,
          options: [
            { label: t("timestamp"), value: "timestamp" },
            { label: t("index"), value: "index" },
            { label: t("currentPath"), value: "currentCustom" },
            { label: t("accumulatedPath"), value: "custom" },
          ],
        },
        xAxisPath:
          config.xAxisVal === "currentCustom" || config.xAxisVal === "custom"
            ? {
                label: t("messagePath"),
                input: "messagepath",
                value: config.xAxisPath?.value ?? "",
                validTypes: PLOTABLE_ROS_TYPES,
              }
            : undefined,
        showXAxisLabels: {
          label: t("showLabels"),
          input: "boolean",
          value: config.showXAxisLabels,
        },
        minXValue: {
          label: t("min"),
          input: "number",
          value: _.isNumber(config.minXValue) ? config.minXValue : undefined,
          placeholder: "auto",
        },
        maxXValue: {
          label: t("max"),
          input: "number",
          error: maxXError,
          value: _.isNumber(config.maxXValue) ? config.maxXValue : undefined,
          placeholder: "auto",
        },
        followingViewWidth: {
          label: t("secondsRange"),
          input: "number",
          placeholder: "auto",
          value: config.followingViewWidth,
        },
      },
    },
    paths: makeRootSeriesNode({ paths: config.paths, t }),
  };
}
