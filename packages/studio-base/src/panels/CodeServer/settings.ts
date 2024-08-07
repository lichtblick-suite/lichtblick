// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import { set } from "lodash";
import { useCallback, useEffect } from "react";

import { SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { CodeServerConfig } from "./types";

function buildSettingsTree(config: CodeServerConfig): SettingsTreeNodes {
  return {
    general: {
      label: "Network",
      fields: {
        host: {
          label: "host",
          input: "string",
          value: config.host,
          placeholder: "主机",
        },
        port: {
          label: "port",
          input: "string",
          value: config.port,
          placeholder: "端口",
        },
        password: {
          label: "password",
          input: "string",
          value: config.password,
          placeholder: "端口",
        },
      },
    },
  };
}

export function useCodeServerSettings(
  config: CodeServerConfig,
  saveConfig: SaveConfig<CodeServerConfig>,
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      saveConfig(
        produce<CodeServerConfig>((draft) => {
          const path = action.payload.path.slice(1);

          set(draft, path, action.payload.value);
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
