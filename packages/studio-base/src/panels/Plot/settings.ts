// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import produce from "immer";
import { isEqual, isNumber, set } from "lodash";
import memoizeWeak from "memoize-weak";
import { useCallback, useEffect } from "react";

import { SettingsTreeAction, SettingsTreeNode, SettingsTreeNodes } from "@foxglove/studio";
import { PlotPath } from "@foxglove/studio-base/panels/Plot/internalTypes";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { lineColors } from "@foxglove/studio-base/util/plotColors";

import { plotableRosTypes, PlotConfig, plotPathDisplayName } from "./types";

const makeSeriesNode = memoizeWeak((path: PlotPath, index: number): SettingsTreeNode => {
  return {
    actions: [
      {
        type: "action",
        id: "delete-series",
        label: "Delete series",
        display: "inline",
        icon: "Clear",
      },
    ],
    label: plotPathDisplayName(path, index),
    visible: path.enabled,
    fields: {
      label: {
        input: "string",
        label: "Label",
        value: path.label,
      },
      value: {
        label: "Message path",
        input: "messagepath",
        value: path.value,
        validTypes: plotableRosTypes,
      },
      color: {
        input: "rgb",
        label: "Color",
        value: path.color ?? lineColors[index % lineColors.length],
      },
      timestampMethod: {
        input: "select",
        label: "Timestamp",
        value: path.timestampMethod,
        options: [
          { label: "Receive Time", value: "receiveTime" },
          { label: "Header Stamp", value: "headerStamp" },
        ],
      },
    },
  };
});

const makeRootSeriesNode = memoizeWeak((paths: PlotPath[]): SettingsTreeNode => {
  const children = Object.fromEntries(
    paths.map((path, index) => [`${index}`, makeSeriesNode(path, index)]),
  );
  return {
    label: "Series",
    children,
    actions: [
      {
        type: "action",
        id: "add-series",
        label: "Add series",
        display: "inline",
        icon: "Addchart",
      },
    ],
  };
});

function buildSettingsTree(config: PlotConfig): SettingsTreeNodes {
  const maxYError =
    isNumber(config.minYValue) && isNumber(config.maxYValue) && config.minYValue >= config.maxYValue
      ? "Y max must be greater than Y min."
      : undefined;

  const maxXError =
    isNumber(config.minXValue) && isNumber(config.maxXValue) && config.minXValue >= config.maxXValue
      ? "X max must be greater than X min."
      : undefined;

  return {
    general: {
      label: "General",
      fields: {
        isSynced: { label: "Sync with other plots", input: "boolean", value: config.isSynced },
      },
    },
    legend: {
      label: "Legend",
      fields: {
        legendDisplay: {
          label: "Position",
          input: "select",
          value: config.showLegend ? config.legendDisplay : "none",
          options: [
            { value: "floating", label: "Floating" },
            { value: "left", label: "Left" },
            { value: "top", label: "Top" },
            { value: "none", label: "None" },
          ],
        },
        showPlotValuesInLegend: {
          label: "Show values",
          input: "boolean",
          value: config.showPlotValuesInLegend,
        },
      },
    },
    yAxis: {
      label: "Y Axis",
      defaultExpansionState: "collapsed",
      fields: {
        showYAxisLabels: {
          label: "Show labels",
          input: "boolean",
          value: config.showYAxisLabels,
        },
        minYValue: {
          label: "Min",
          input: "number",
          value: config.minYValue != undefined ? Number(config.minYValue) : undefined,
          placeholder: "auto",
        },
        maxYValue: {
          label: "Max",
          input: "number",
          error: maxYError,
          value: config.maxYValue != undefined ? Number(config.maxYValue) : undefined,
          placeholder: "auto",
        },
      },
    },
    xAxis: {
      label: "X Axis",
      defaultExpansionState: "collapsed",
      fields: {
        xAxisVal: {
          label: "Value",
          input: "select",
          value: config.xAxisVal,
          options: [
            { label: "Timestamp", value: "timestamp" },
            { label: "Index", value: "index" },
            { label: "Path (current)", value: "currentCustom" },
            { label: "Path (accumulated)", value: "custom" },
          ],
        },
        xAxisPath:
          config.xAxisVal === "currentCustom" || config.xAxisVal === "custom"
            ? {
                label: "Message path",
                input: "messagepath",
                value: config.xAxisPath?.value ?? "",
                validTypes: plotableRosTypes,
              }
            : undefined,
        showXAxisLabels: {
          label: "Show labels",
          input: "boolean",
          value: config.showXAxisLabels,
        },
        minXValue: {
          label: "Min",
          input: "number",
          value: config.minXValue != undefined ? Number(config.minXValue) : undefined,
          placeholder: "auto",
        },
        maxXValue: {
          label: "Max",
          input: "number",
          error: maxXError,
          value: config.maxXValue != undefined ? Number(config.maxXValue) : undefined,
          placeholder: "auto",
        },
        followingViewWidth: {
          label: "Range (seconds)",
          input: "number",
          placeholder: "auto",
          value: config.followingViewWidth,
        },
      },
    },
    paths: makeRootSeriesNode(config.paths),
  };
}

export function usePlotPanelSettings(
  config: PlotConfig,
  saveConfig: SaveConfig<PlotConfig>,
  focusedPath?: readonly string[],
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

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
              if (value === "none") {
                draft.showLegend = false;
              } else {
                draft.legendDisplay = value;
                draft.showLegend = true;
              }
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
      nodes: buildSettingsTree(config),
    });
  }, [actionHandler, config, focusedPath, updatePanelSettingsTree]);
}
