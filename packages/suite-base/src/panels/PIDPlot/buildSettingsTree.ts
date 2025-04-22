// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TFunction } from "i18next";
import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";

import { SettingsTreeNode, SettingsTreeNodes } from "@lichtblick/suite";
import {
  DEFAULT_PIDLINEPLOT_PATH,
  DEFAULT_PIDPLOT_PATH,
} from "@lichtblick/suite-base/panels/Plot/constants";
import {
  PIDLinePlotPath,
  PIDPlotConfig, PIDPlotPath,
  plotPathDisplayName
} from "@lichtblick/suite-base/panels/Plot/utils/config";
import { PLOTABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/shared/constants";
import { lineColors } from "@lichtblick/suite-base/util/plotColors";

type MakeSeriesNode = {
  path: PIDPlotPath;
  index: number;
  canDelete: boolean;

  t: TFunction<"plot">;
};
type MakeSeriesPIDNode  = {
  pidline: PIDLinePlotPath;
  index: number;
  canDelete: boolean;

  t: TFunction<"plot">;
};

type MakeRootSeriesNode = {
  paths: PIDPlotPath[];
  t: TFunction<"plot">;
};
type MakeRootSeriesPIDNode = {
  pidpaths: PIDLinePlotPath[];
  t: TFunction<"plot">;
};

export function buildSettingsTree(config: PIDPlotConfig, t: TFunction<"plot">): SettingsTreeNodes {
  // 确保 config.pidpaths 不为 undefined
  if (!config.paths) {
    config.paths = [];
  }

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
            // { value: "none", label: t("hidden") },
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
          value: config.minXValue != undefined ? Number(config.minXValue) : undefined,
          placeholder: "auto",
        },
        maxXValue: {
          label: t("max"),
          input: "number",
          error: maxXError,
          value: config.maxXValue != undefined ? Number(config.maxXValue) : undefined,
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
    pidline:makeRootSeriesPIDNode({ pidpaths: config.pidline, t }),
    // pidline:makeSeriesPIDNode({ canDelete: false, pidline: DEFAULT_PIDLINEPLOT_PATH, index: 0, t })
  };
}

const makeSeriesNode = memoizeWeak(
  ({ canDelete, index, path, t }: MakeSeriesNode): SettingsTreeNode => {
    // 校验 path 对象及其关键属性
    if (!path || typeof path !== 'object') {
      throw new Error('Invalid path object');
    }

    const validPath = {

      value: path.value || '',
      enabled: path.enabled || false,
      color: path.color,
      label: path.label,
      timestampMethod: path.timestampMethod || 'receiveTime',
      showLine: path.showLine,
      lineSize: path.lineSize,
      pidtype: path.pidtype || "pnumber", // 默认类型
    };

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
      label: plotPathDisplayName(validPath, index),
      visible: validPath.enabled,
      fields: {
        value: {
          input: "messagepath",
          label: t("messagePath"),
          supportsMathModifiers: true,
          validTypes: PLOTABLE_ROS_TYPES,
          value: validPath.value,
        },
        label: {
          input: "string",
          label: t("label"),
          value: validPath.label,
        },
        color: {
          input: "rgb",
          label: t("color"),
          value: validPath.color ?? lineColors[index % lineColors.length],
        },
        lineSize: {
          input: "number",
          label: t("lineSize"),
          value: validPath.lineSize,
          step: 0.2,
          min: 0,
          placeholder: "auto",
        },
        showLine: {
          input: "boolean",
          label: t("showLine"),
          value: validPath.showLine ?? true,
        },
        timestampMethod: {
          input: "select",
          label: t("timestamp"),
          options: [
            { label: t("receiveTime"), value: "receiveTime" },
            { label: t("headerStamp"), value: "headerStamp" },
          ],
          value: validPath.timestampMethod,
        },
        pidtype: {
          input: "select",
          label: t("pidtype"),
          options: [
            { label: t("pnumber"), value: "pnumber" },
            { label: t("inumber"), value: "inumber" },
            { label: t("dnumber"), value: "dnumber" },
          ],
          value: validPath.pidtype,
        },
      },
    };
  },
);
const makeSeriesPIDNode = memoizeWeak(
  ({canDelete, index, pidline, t }: MakeSeriesPIDNode): SettingsTreeNode => {
    // 校验 path 对象及其关键属性
    if (!pidline || typeof pidline !== 'object') {
      throw new Error('Invalid path object');
    }

    const validPath = {

      value: pidline.value || '',
      enabled: pidline.enabled || false,
      color: pidline.color,
      label: pidline.label,
      timestampMethod: pidline.timestampMethod || 'receiveTime',
      showLine: pidline.showLine,
      lineSize: pidline.lineSize,
      kp: pidline.kp,
      ki: pidline.ki,
      kd: pidline.kd,
    };

    return {
      actions: canDelete
        ? [
          {
            type: "action",
            id: "delete-pidseries",
            label: t("deleteSeries"),
            display: "inline",
            icon: "Clear",
          },
        ]
        : [],
      label: plotPathDisplayName(validPath, index),
      visible: validPath.enabled,
      fields: {
        value: {
          input: "messagepath",
          label: t("messagePath"),
          supportsMathModifiers: true,
          validTypes: PLOTABLE_ROS_TYPES,
          value: validPath.value,
        },
        label: {
          input: "string",
          label: t("label"),
          value: validPath.label,
        },
        color: {
          input: "rgb",
          label: t("color"),
          value: validPath.color ?? lineColors[index % lineColors.length],
        },
        lineSize: {
          input: "number",
          label: t("lineSize"),
          value: validPath.lineSize,
          step: 0.2,
          min: 0,
          placeholder: "auto",
        },
        showLine: {
          input: "boolean",
          label: t("showLine"),
          value: validPath.showLine ?? true,
        },
        timestampMethod: {
          input: "select",
          label: t("timestamp"),
          options: [
            { label: t("receiveTime"), value: "receiveTime" },
            { label: t("headerStamp"), value: "headerStamp" },
          ],
          value: validPath.timestampMethod,
        },
        kp: {
          input: "number",
          label: t("pnumber"),
          value: validPath.kp,
        },
        ki: {
          input: "number",
          label: t("inumber"),
          value: validPath.ki,
        },
        kd: {
          input: "number",
          label: t("dnumber"),
          value: validPath.kd,
        },
      },
    };
  },
);

const makeRootSeriesNode = memoizeWeak(({ paths, t }: MakeRootSeriesNode): SettingsTreeNode => {
  const children = Object.fromEntries(
    paths.length === 0
      ? [["default", makeSeriesNode({ canDelete: false, path: DEFAULT_PIDPLOT_PATH, index: 0, t })]]
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
const makeRootSeriesPIDNode = memoizeWeak(({ pidpaths, t }: MakeRootSeriesPIDNode): SettingsTreeNode => {
  const children = Object.fromEntries(
    pidpaths.length === 0
      ? [["defaultline", makeSeriesPIDNode({ canDelete: false, pidline: DEFAULT_PIDLINEPLOT_PATH, index: 0, t })]]
      : pidpaths.map((pidline, index) => [
        `${index}`,
        makeSeriesPIDNode({ canDelete: true, index, pidline, t }),
      ]),
  );
  return {
    label: t("pidline"),
    children,
    actions: [
      {
        type: "action",
        id: "add-pidseries",
        display: "inline",
        icon: "Addchart",
        label: t("addSeries"),
      },
    ],
  };
});
