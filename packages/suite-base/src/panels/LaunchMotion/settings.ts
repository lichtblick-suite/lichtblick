// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import * as _ from "lodash-es";
import { useCallback, useEffect, useMemo } from "react";

import { Immutable, SettingsTreeAction, SettingsTreeNodes } from "@lichtblick/suite";
import { Topic } from "@lichtblick/suite-base/players/types";
import {
  useDefaultPanelTitle,
  usePanelSettingsTreeUpdate,
} from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { NodesMonitorConfig } from "./types";

export const defaultConfig: NodesMonitorConfig = {
  activeLaunchSource: "/active_node",
  activeNodeSource: "/active_launch",
};

// function datatypeError(schemaNames: string[], datatype?: string) {
//   if (!datatype) {
//     return "Message schema cannot be empty";
//   }
//   if (!schemaNames.includes(datatype)) {
//     return "Schema name not found";
//   }
//   return undefined;
// }

function topicError(topicName?: string) {
  if (!topicName) {
    return "Topic cannot be empty";
  }
  return undefined;
}

function buildSettingsTree(
  config: NodesMonitorConfig,
  schemaNames: string[],
  topics: readonly Topic[],
): SettingsTreeNodes {
  return {
    node_publish: {
      label: "subscribe",
      fields: {
        NodeTopicName: {
          label: "Topic",
          input: "autocomplete",
          error: topicError(config.activeLaunchSource),
          value: config.activeLaunchSource,
          items: topics.map((t) => t.name),
        },
        // NodeDatatype: {
        //   label: "Schema",
        //   input: "autocomplete",
        //   error: datatypeError(schemaNames, config.activeLaunchSource),
        //   items: schemaNames,
        //   value: config.nodeDatatype,
        // },
      },
    },
    // run_publish: {
    //   label: "RunPublish",
    //   fields: {
    //     RunTopicName: {
    //       label: "Topic",
    //       input: "autocomplete",
    //       error: topicError(config.runTopicName),
    //       value: config.runTopicName,
    //       items: topics.map((t) => t.name),
    //     },
    //     RunDatatype: {
    //       label: "Schema",
    //       input: "autocomplete",
    //       error: datatypeError(schemaNames, config.runDatatype),
    //       items: schemaNames,
    //       value: config.nodeDatatype,
    //     },
    //   },
    // },
    // source: {
    //   label: "Source",
    //   fields: {
    //     rfid: {
    //       label: "Rfid",
    //       input: "autocomplete",
    //       error: topicError(config.rfidSource),
    //       value: config.rfidSource,
    //       items: topics.map((t) => t.name),
    //     },
    //     path: {
    //       label: "Path",
    //       input: "autocomplete",
    //       error: topicError(config.pathSource),
    //       value: config.pathSource,
    //       items: topics.map((t) => t.name),
    //     },
    //     battery: {
    //       label: "Battery",
    //       input: "autocomplete",
    //       error: topicError(config.batterySource),
    //       value: config.batterySource,
    //       items: topics.map((t) => t.name),
    //     },
    //   },
    // },

    control: {
      label: "Control",
      fields: {
        // car_id: {
        //   label: "Car ID",
        //   input: "select",
        //   value: config.car_id,
        //   options: [
        //     { label: "1", value: 1 },
        //     { label: "2", value: 2 },
        //     { label: "3", value: 3 },
        //     { label: "4", value: 4 },
        //   ],
        // },
        // pass_mode: {
        //   label: "PassMode",
        //   input: "boolean",
        //   value: config.pass_mode,
        // },
        // run: {
        //   label: "Run",
        //   input: "boolean",
        //   value: config.run,
        // },
        // upload_map: {
        //   label: "UploadMap",
        //   input: "boolean",
        //   value: config.uploadMap,
        // },
        // lights: {
        //   label: "UploadMap",
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
  config: NodesMonitorConfig,
  saveConfig: SaveConfig<NodesMonitorConfig>,
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
        produce<NodesMonitorConfig>((draft) => {
          if (input === "autocomplete") {
            if (_.isEqual(path, ["general", "topicName"])) {
              const topicSchemaName = topics.find((t) => t.name === value)?.schemaName;
              setDefaultPanelTitle(value ? `Publish ${value}` : "Publish");

              draft.activeLaunchSource = value ?? "";
              draft.activeNodeSource = value ?? "";

              if (topicSchemaName) {
                draft.activeLaunchSource = topicSchemaName;
                draft.activeNodeSource = topicSchemaName;
              }
            }
          } else {
            _.set(draft, path.slice(1), value);
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
