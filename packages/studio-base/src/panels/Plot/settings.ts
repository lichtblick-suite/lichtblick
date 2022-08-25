// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import produce from "immer";
import { isNumber, set } from "lodash";
import { useCallback, useEffect } from "react";

import { SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { PlotConfig } from "./types";

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
      icon: "Settings",
      fields: {
        title: { label: "Title", input: "string", value: config.title, placeholder: "Plot" },
        isSynced: { label: "Sync with other plots", input: "boolean", value: config.isSynced },
        legendDisplay: {
          label: "Legend position",
          input: "select",
          value: config.legendDisplay,
          options: [
            { value: "floating", label: "Floating" },
            { value: "left", label: "Left" },
            { value: "top", label: "Top" },
          ],
        },
        showPlotValuesInLegend: {
          label: "Show plot values in legend",
          input: "boolean",
          value: config.showPlotValuesInLegend,
        },
      },
    },
    yAxis: {
      label: "Y Axis",
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
      fields: {
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
  };
}

export function usePlotPanelSettings(config: PlotConfig, saveConfig: SaveConfig<PlotConfig>): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { path, value } = action.payload;
      saveConfig(
        produce((draft) => {
          set(draft, path.slice(1), value);

          // X min/max and following width are mutually exclusive.
          if (path[1] === "followingViewWidth") {
            draft.minXValue = undefined;
            draft.maxXValue = undefined;
          } else if (path[1] === "minXValue" || path[1] === "maxXValue") {
            draft.followingViewWidth = undefined;
          }
        }),
      );
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config),
    });
  }, [actionHandler, config, updatePanelSettingsTree]);
}
