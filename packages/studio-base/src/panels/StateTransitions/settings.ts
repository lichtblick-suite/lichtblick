// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TFunction } from "i18next";
import { produce } from "immer";
import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { SettingsTreeAction, SettingsTreeNode, SettingsTreeNodes } from "@foxglove/studio";
import { plotableRosTypes } from "@foxglove/studio-base/panels/Plot";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { DEFAULT_PATH, stateTransitionPathDisplayName } from "./shared";
import { StateTransitionConfig, StateTransitionPath } from "./types";

// Note - we use memoizeWeak here instead of react memoization to allow us to memoize
// at the level of individual nodes in our tree. This keeps our DOM updates small since
// the NodeEditor component is wrapped in a React.memo.

export type PathState = {
  path: StateTransitionPath;
  // Whether the data the path refers to resolves to more than one value
  isArray: boolean;
};
const makeSeriesNode = memoizeWeak(
  (
    index: number,
    { path, canDelete, isArray }: PathState & { canDelete: boolean },
  ): SettingsTreeNode => {
    return {
      actions: canDelete
        ? [
            {
              type: "action",
              id: "delete-series",
              label: "Delete series",
              display: "inline",
              icon: "Clear",
            },
          ]
        : [],
      label: stateTransitionPathDisplayName(path, index),
      fields: {
        value: {
          label: "Message path",
          input: "messagepath",
          value: path.value,
          validTypes: plotableRosTypes,
          ...(isArray ? { error: "This path resolves to more than one value" } : {}),
        },
        label: {
          input: "string",
          label: "Label",
          value: path.label,
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
  },
);

const makeRootSeriesNode = memoizeWeak((paths: PathState[]): SettingsTreeNode => {
  const children = Object.fromEntries(
    paths.length === 0
      ? [["0", makeSeriesNode(0, { path: DEFAULT_PATH, isArray: false, canDelete: false })]]
      : paths.map(({ path, isArray }, index) => [
          `${index}`,
          makeSeriesNode(index, {
            path,
            isArray,
            canDelete: true,
          }),
        ]),
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

function buildSettingsTree(
  config: StateTransitionConfig,
  paths: PathState[],
  t: TFunction<"stateTransitions">,
): SettingsTreeNodes {
  const maxXError =
    _.isNumber(config.xAxisMinValue) &&
    _.isNumber(config.xAxisMaxValue) &&
    config.xAxisMinValue >= config.xAxisMaxValue
      ? t("maxXError")
      : undefined;

  return {
    general: {
      label: "General",
      fields: {
        isSynced: { label: "Sync with other plots", input: "boolean", value: config.isSynced },
      },
    },
    xAxis: {
      label: t("xAxis"),
      fields: {
        xAxisMinValue: {
          label: t("min"),
          input: "number",
          value: config.xAxisMinValue != undefined ? Number(config.xAxisMinValue) : undefined,
          placeholder: "auto",
        },
        xAxisMaxValue: {
          label: t("max"),
          input: "number",
          error: maxXError,
          value: config.xAxisMaxValue != undefined ? Number(config.xAxisMaxValue) : undefined,
          placeholder: "auto",
        },
        xAxisRange: {
          label: t("secondsRange"),
          input: "number",
          placeholder: "auto",
          value: config.xAxisRange,
        },
      },
    },
    paths: makeRootSeriesNode(paths),
  };
}

export function useStateTransitionsPanelSettings(
  config: StateTransitionConfig,
  saveConfig: SaveConfig<StateTransitionConfig>,
  paths: PathState[],
  focusedPath?: readonly string[],
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const { t } = useTranslation("stateTransitions");

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { input, path, value } = action.payload;
        if (input === "boolean" && _.isEqual(path, ["general", "isSynced"])) {
          saveConfig({ isSynced: value });
        } else if (path[0] === "xAxis") {
          saveConfig(
            produce((draft) => {
              _.set(draft, path.slice(1), value);

              // X min/max and range are mutually exclusive.
              if (path[1] === "xAxisRange") {
                draft.xAxisMinValue = undefined;
                draft.xAxisMaxValue = undefined;
              } else if (path[1] === "xAxisMinValue" || path[1] === "xAxisMaxValue") {
                draft.xAxisRange = undefined;
              }
            }),
          );
        } else {
          saveConfig(
            produce((draft: StateTransitionConfig): void => {
              if (draft.paths.length === 0) {
                draft.paths.push({ ...DEFAULT_PATH });
              }
              _.set(draft, path, value);
            }),
          );
        }
      }

      if (action.action === "perform-node-action") {
        if (action.payload.id === "add-series") {
          saveConfig(
            produce((draft) => {
              if (draft.paths.length === 0) {
                draft.paths.push({ ...DEFAULT_PATH });
              }
              draft.paths.push({ ...DEFAULT_PATH });
            }),
          );
        } else if (action.payload.id === "delete-series") {
          const index = action.payload.path[1];
          saveConfig(
            produce((draft) => {
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
      nodes: buildSettingsTree(config, paths, t),
    });
  }, [actionHandler, paths, config, focusedPath, t, updatePanelSettingsTree]);
}
