// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import { set } from "lodash";
import { useCallback, useEffect } from "react";

import { SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
// import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { Joysetting } from "./types";

function topicError(topicName?: string) {
  if (!topicName) {
    return "Topic cannot be empty";
  }
  return undefined;
}
function buildSettingsTree(config: Joysetting, topics: readonly Topic[]): SettingsTreeNodes {
  return {
    general: {
      label: "JoySetting",
      fields: {
        topic: {
          label: "Topic",
          input: "autocomplete",
          error: topicError(config.topic),
          value: config.topic,
          items: topics
            .filter((t) => t.schemaName === "geometry_msgs/msg/Twist")
            .map((t) => t.name),
        },
        vel: {
          label: "Vel max",
          input: "number",
          value: config.vel,
          placeholder: "0.2",
        },
        angle: {
          label: "Angle max",
          input: "number",
          value: config.angle,
          placeholder: "0.8",
        },
      },
    },
  };
}

export function useCodeServerSettings(
  config: Joysetting,
  saveConfig: SaveConfig<Joysetting>,
  topics: readonly Topic[],
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
        produce<Joysetting>((draft) => {
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
      nodes: buildSettingsTree(config, topics),
    });
  }, [actionHandler, config, topics, updatePanelSettingsTree]);
}
