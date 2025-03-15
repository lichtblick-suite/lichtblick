// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import * as _ from "lodash-es";
import { useCallback, useEffect } from "react";

import { SettingsTreeAction, SettingsTreeNodes } from "@lichtblick/suite";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
// import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { DeviceSetting } from "./types";

function buildSettingsTree(config: DeviceSetting): SettingsTreeNodes {
  return {
    general: {
      label: "Device Settings",
      fields: {
        mqttHost: {
          label: "MQTT Address",
          input: "string",
          value: config.mqttHost,
          placeholder: "MQTT主机",
        },
        port: {
          label: "MQTT Port",
          input: "number",
          value: config.port,
          placeholder: "MQTT主机端口",
        },
        save: {
          label: "连接",
          input: "boolean",
          value: config.save,
        },
      },
    },
  };
}

export function useDeviceSettings(
  config: DeviceSetting,
  saveConfig: SaveConfig<DeviceSetting>,
  // datatypes: Immutable<RosDatatypes>,
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  // const schemaNames = useMemo(() => Array.from(datatypes.keys()).sort(), [datatypes]);

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      saveConfig(
        produce<DeviceSetting>((draft) => {
          const path = action.payload.path.slice(1);

          _.set(draft, path, action.payload.value);
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
