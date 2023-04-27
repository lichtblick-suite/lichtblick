// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import { isEqual, set } from "lodash";
import memoizeWeak from "memoize-weak";
import { useCallback, useEffect } from "react";

import { SettingsTreeAction, SettingsTreeNode, SettingsTreeNodes } from "@foxglove/studio";
import { plotableRosTypes } from "@foxglove/studio-base/panels/Plot";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { stateTransitionPathDisplayName } from "./shared";
import { StateTransitionConfig, StateTransitionPath } from "./types";

// Note - we use memoizeWeak here instead of react memoization to allow us to memoize
// at the level of individual nodes in our tree. This keeps our DOM updates small since
// the NodeEditor component is wrapped in a React.memo.

const makeSeriesNode = memoizeWeak((path: StateTransitionPath, index: number): SettingsTreeNode => {
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
    label: stateTransitionPathDisplayName(path, index),
    fields: {
      value: {
        label: "Message path",
        input: "messagepath",
        value: path.value,
        validTypes: plotableRosTypes,
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
});

const makeRootSeriesNode = memoizeWeak((paths: StateTransitionPath[]): SettingsTreeNode => {
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

function buildSettingsTree(config: StateTransitionConfig): SettingsTreeNodes {
  return {
    general: {
      label: "General",
      fields: {
        isSynced: { label: "Sync with other plots", input: "boolean", value: config.isSynced },
      },
    },
    paths: makeRootSeriesNode(config.paths),
  };
}

export function useStateTransitionsPanelSettings(
  config: StateTransitionConfig,
  saveConfig: SaveConfig<StateTransitionConfig>,
  focusedPath?: readonly string[],
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { input, path, value } = action.payload;
        if (input === "boolean" && isEqual(path, ["general", "isSynced"])) {
          saveConfig({ isSynced: value });
        } else {
          saveConfig(
            produce((draft) => {
              set(draft, path, value);
            }),
          );
        }
      }

      if (action.action === "perform-node-action") {
        if (action.payload.id === "add-series") {
          saveConfig(
            produce((draft) => {
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
      nodes: buildSettingsTree(config),
    });
  }, [actionHandler, config, focusedPath, updatePanelSettingsTree]);
}
