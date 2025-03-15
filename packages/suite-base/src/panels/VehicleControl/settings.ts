/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import * as _ from "lodash-es";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  car_id: "map1.json",
  update_map: false,
  pass_mode: false,
  nodeTopicName: "/nav_select",
  nodeDatatype: "msg_interfaces/msg/NavSelectInterface",
  runTopicName: "/emergency_stop",
  runDatatype: "msg_interfaces/msg/EmergencyInterface",
  rfidSource: "/rfid_data",
  pathSource: "/gpp_path",
  batterySource: "/battery_state",
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
  _mapFiles: string[],
): SettingsTreeNodes {
  return {
    node_publish: {
      label: "Publish",
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
        upload_map: {
          label: "UMap",
          input: "boolean",
          value: config.update_map,
        },
      },
    },
    source: {
      label: "Source",
      fields: {
        rfid: {
          label: "Topic",
          input: "autocomplete",
          error: topicError(config.rfidSource),
          value: config.rfidSource,
          items: topics.map((t) => t.name),
        },
        path: {
          label: "Topic",
          input: "autocomplete",
          error: topicError(config.pathSource),
          value: config.pathSource,
          items: topics.map((t) => t.name),
        },
        battery: {
          label: "Topic",
          input: "autocomplete",
          error: topicError(config.batterySource),
          value: config.batterySource,
          items: topics.map((t) => t.name),
        },
      },
    },
    // control: {
    //   label: "地图切换",
    //   fields: {
    //     car_id: {
    //       label: "Map",
    //       input: "select",
    //       value: config.car_id,
    //       options: mapFiles.map((filename) => ({
    //         label: filename.replace(".json", ""),
    //         value: filename,
    //       })),
    //     },
    //   },
    // },
  };
}

export function useVehicleControlSettings(
  config: VehicleControlConfig,
  saveConfig: SaveConfig<VehicleControlConfig>,
  topics: readonly Topic[],
  datatypes: Immutable<RosDatatypes>,
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const [mapFiles, setMapFiles] = useState<string[]>([]);
  const [, setDefaultPanelTitle] = useDefaultPanelTitle();
  const schemaNames = useMemo(() => Array.from(datatypes.keys()).sort(), [datatypes]);
  // 添加获取文件列表的 effect
  useEffect(() => {
    const loadMapFiles = async () => {
      try {
        const result = await window.electron.fileRenderer.listFiles("documents");
        if (result.success && result.data) {
          // 只过滤 .json 文件
          const jsonFiles = result.data.filter((file: string) => file.endsWith(".json"));
          setMapFiles(jsonFiles);
        }
      } catch (error) {
        console.error("Failed to load map files:", error);
      }
    };
    loadMapFiles();
  }, []);
  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { path, value, input } = action.payload;

      saveConfig(
        produce<VehicleControlConfig>((draft) => {
          // 获取完整路径字符串
          if (path.length === 1 && path[0] === "upload_map") {
            draft.update_map = typeof value === "boolean" ? value : false;
            return;
          }
          // 处理特殊情况

          if (input === "autocomplete") {
            if (_.isEqual(path, ["general", "topicName"])) {
              const topicSchemaName = topics.find((t) => t.name === value)?.schemaName;
              setDefaultPanelTitle(value ? `Publish ${value}` : "Publish");
              draft.nodeTopicName = value ?? "";
              draft.runTopicName = value ?? "";
              if (topicSchemaName) {
                draft.nodeDatatype = topicSchemaName;
                draft.runDatatype = topicSchemaName;
              }
            } else if (_.isEqual(path, ["general", "datatype"])) {
              draft.nodeDatatype = value ?? "";
            }
          } else {
            _.set(draft, path.slice(1), value);
            draft.update_map = typeof value === "boolean" ? value : false;
          }

          // 处理其他情况
          // switch (pathString) {
          //   case "node_publish.NodeTopicName":
          //     draft.nodeTopicName = value ?? "";
          //     const topicSchemaName = topics.find((t) => t.name === value)?.schemaName;
          //     if (topicSchemaName) {
          //       draft.nodeDatatype = topicSchemaName;
          //     }
          //     break;
          //   case "node_publish.NodeDatatype":
          //     draft.nodeDatatype = value;
          //     break;
          //   case "node_publish.upload_map":
          //     draft.update_map = value;
          //     break;
          //   case "source.rfid":
          //     draft.rfidSource = value;
          //     break;
          //   case "source.path":
          //     draft.pathSource = value;
          //     break;
          //   case "source.battery":
          //     draft.batterySource = value;
          //     break;
          //   case "control.car_id":
          //     draft.car_id = value;
          //     break;
          //   default:
          //     console.warn("Unhandled path:", path);
          // }
        }),
      );
    },
    [saveConfig, setDefaultPanelTitle, topics],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config, schemaNames, topics, mapFiles),
    });
  }, [actionHandler, config, schemaNames, topics, updatePanelSettingsTree, mapFiles]);
}
