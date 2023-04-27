// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TFunction } from "i18next";
import { produce } from "immer";
import { isEqual, isNumber, set } from "lodash";
import memoizeWeak from "memoize-weak";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { SettingsTreeAction, SettingsTreeNode, SettingsTreeNodes } from "@foxglove/studio";
import { PlotPath } from "@foxglove/studio-base/panels/Plot/internalTypes";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { lineColors } from "@foxglove/studio-base/util/plotColors";

import { plotableRosTypes, PlotConfig, plotPathDisplayName } from "./types";

const makeSeriesNode = memoizeWeak(
  (path: PlotPath, index: number, t: TFunction<"plot">): SettingsTreeNode => {
    return {
      actions: [
        {
          type: "action",
          id: "delete-series",
          label: t("deleteSeries"),
          display: "inline",
          icon: "Clear",
        },
      ],
      label: plotPathDisplayName(path, index),
      visible: path.enabled,
      fields: {
        value: {
          label: t("messagePath"),
          input: "messagepath",
          value: path.value,
          validTypes: plotableRosTypes,
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
        timestampMethod: {
          input: "select",
          label: t("timestamp"),
          value: path.timestampMethod,
          options: [
            { label: t("receiveTime"), value: "receiveTime" },
            { label: t("headerStamp"), value: "headerStamp" },
          ],
        },
      },
    };
  },
);

const makeRootSeriesNode = memoizeWeak(
  (paths: PlotPath[], t: TFunction<"plot">): SettingsTreeNode => {
    const children = Object.fromEntries(
      paths.map((path, index) => [`${index}`, makeSeriesNode(path, index, t)]),
    );
    return {
      label: t("series"),
      children,
      actions: [
        {
          type: "action",
          id: "add-series",
          label: t("addSeries"),
          display: "inline",
          icon: "Addchart",
        },
      ],
    };
  },
);

function buildSettingsTree(config: PlotConfig, t: TFunction<"plot">): SettingsTreeNodes {
  const maxYError =
    isNumber(config.minYValue) && isNumber(config.maxYValue) && config.minYValue >= config.maxYValue
      ? t("maxYError")
      : undefined;

  const maxXError =
    isNumber(config.minXValue) && isNumber(config.maxXValue) && config.minXValue >= config.maxXValue
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
                validTypes: plotableRosTypes,
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
    paths: makeRootSeriesNode(config.paths, t),
  };
}

export function usePlotPanelSettings(
  config: PlotConfig,
  saveConfig: SaveConfig<PlotConfig>,
  focusedPath?: readonly string[],
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const { t } = useTranslation("plot");

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { path, value } = action.payload;
        saveConfig(
          produce((draft) => {
            if (path[0] === "paths") {
              if (path[2] === "visible") {
                set(draft, [...path.slice(0, 2), "enabled"], value);
              } else {
                set(draft, path, value);
              }
            } else if (isEqual(path, ["legend", "legendDisplay"])) {
              draft.legendDisplay = value;
              draft.showLegend = true;
            } else if (isEqual(path, ["xAxis", "xAxisPath"])) {
              set(draft, ["xAxisPath", "value"], value);
            } else {
              set(draft, path.slice(1), value);

              // X min/max and following width are mutually exclusive.
              if (path[1] === "followingViewWidth") {
                draft.minXValue = undefined;
                draft.maxXValue = undefined;
              } else if (path[1] === "minXValue" || path[1] === "maxXValue") {
                draft.followingViewWidth = undefined;
              }
            }
          }),
        );
      } else {
        if (action.payload.id === "add-series") {
          saveConfig(
            produce<PlotConfig>((draft) => {
              draft.paths.push({
                timestampMethod: "receiveTime",
                value: "",
                enabled: true,
              });
            }),
          );
        } else if (action.payload.id === "delete-series") {
          const index = action.payload.path[1];
          saveConfig(
            produce<PlotConfig>((draft) => {
              draft.paths.splice(Number(index), 1);
            }),
          );
        }
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      focusedPath,
      nodes: buildSettingsTree(config, t),
    });
  }, [actionHandler, config, focusedPath, updatePanelSettingsTree, t]);
}
