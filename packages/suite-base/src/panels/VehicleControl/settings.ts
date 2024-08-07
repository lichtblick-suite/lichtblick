// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import { isEqual, set } from "lodash";
import { useCallback, useEffect, useMemo } from "react";

import { Immutable, SettingsTreeAction, SettingsTreeNodes } from "@lichtblick/suite";
import { Topic } from "@lichtblick/suite-base/players/types";
import {
  useDefaultPanelTitle,
  usePanelSettingsTreeUpdate,
} from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { VehicleControlConfig } from "./types";

export const defaultConfig: VehicleControlConfig = {
  car_id: 1,
  lights: false,
  rain: false,
  run: true,
  pass_mode: false,
  nodeTopicName: "/nav_select",
  nodeDatatype: "msg_interfaces/msg/NavSelectInterface",
  runTopicName: "/emergency_stop",
  runDatatype: "msg_interfaces/msg/EmergencyInterface",
  rfidSource: "/rfid_data",
  pathSource: "/gpp_path",
};

function datatypeError(schemaNames: string[], datatype?: string) {
  if (!datatype) {
    return "Message schema cannot be empty";
  }
  if (!schemaNames.includes(datatype)) {
    return "Schema name not found";
  }
  return undefined;
}

function topicError(topicName?: string) {
  if (!topicName) {
    return "Topic cannot be empty";
  }
  return undefined;
}

function buildSettingsTree(
  config: VehicleControlConfig,
  schemaNames: string[],
  topics: readonly Topic[],
): SettingsTreeNodes {
  return {
    node_publish: {
      label: "NodePublish",
      fields: {
        NodeTopicName: {
          label: "Topic",
          input: "autocomplete",
          error: topicError(config.nodeTopicName),
          value: config.nodeTopicName,
          items: topics.map((t) => t.name),
        },
        NodeDatatype: {
          label: "Schema",
          input: "autocomplete",
          error: datatypeError(schemaNames, config.nodeDatatype),
          items: schemaNames,
          value: config.nodeDatatype,
        },
      },
    },
    run_publish: {
      label: "RunPublish",
      fields: {
        RunTopicName: {
          label: "Topic",
          input: "autocomplete",
          error: topicError(config.runTopicName),
          value: config.runTopicName,
          items: topics.map((t) => t.name),
        },
        RunDatatype: {
          label: "Schema",
          input: "autocomplete",
          error: datatypeError(schemaNames, config.runDatatype),
          items: schemaNames,
          value: config.nodeDatatype,
        },
      },
    },
    source: {
      label: "Source",
      fields: {
        rfid: {
          label: "Rfid",
          input: "autocomplete",
          error: topicError(config.rfidSource),
          value: config.rfidSource,
          items: topics.map((t) => t.name),
        },
        path: {
          label: "Path",
          input: "autocomplete",
          error: topicError(config.pathSource),
          value: config.pathSource,
          items: topics.map((t) => t.name),
        },
      },
    },
    control: {
      label: "Control",
      fields: {
        car_id: {
          label: "Car ID",
          input: "select",
          value: config.car_id,
          options: [
            { label: "1", value: 1 },
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
          ],
        },
        pass_mode: {
          label: "PassMode",
          input: "boolean",
          value: config.pass_mode,
        },
        run: {
          label: "Run",
          input: "boolean",
          value: config.run,
        },
        // lights: {
        //   label: "lights",
        //   input: "boolean",
        //   value: config.lights,
        // },
        // rain: {
        //   label: "rain",
        //   input: "boolean",
        //   value: config.rain,
        // },
      },
    },
  };
}

export function useVehicleControlSettings(
  config: VehicleControlConfig,
  saveConfig: SaveConfig<VehicleControlConfig>,
  topics: readonly Topic[],
  datatypes: Immutable<RosDatatypes>,
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const [, setDefaultPanelTitle] = useDefaultPanelTitle();
  const schemaNames = useMemo(() => Array.from(datatypes.keys()).sort(), [datatypes]);

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }
      const { path, value, input } = action.payload;

      saveConfig(
        produce<VehicleControlConfig>((draft) => {
          if (input === "autocomplete") {
            if (isEqual(path, ["general", "topicName"])) {
              const topicSchemaName = topics.find((t) => t.name === value)?.schemaName;
              setDefaultPanelTitle(value ? `Publish ${value}` : "Publish");

              draft.nodeTopicName = value ?? "";
              draft.runTopicName = value ?? "";

              if (topicSchemaName) {
                draft.nodeDatatype = topicSchemaName;
                draft.runDatatype = topicSchemaName;
              }
            } else if (isEqual(path, ["general", "datatype"])) {
              draft.nodeDatatype = value ?? "";
            }
          } else {
            set(draft, path.slice(1), value);
          }
        }),
      );
    },
    [saveConfig, setDefaultPanelTitle, topics],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config, schemaNames, topics),
    });
  }, [actionHandler, config, schemaNames, topics, updatePanelSettingsTree]);
}
