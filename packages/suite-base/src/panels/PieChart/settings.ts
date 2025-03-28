// SPDX-FileCopyrightText: Copyright (C) 2024-2025 Yukihiro Saito <yukky.saito@gmail.com>
// SPDX-License-Identifier: MPL-2.0

import { produce } from "immer";
import * as _ from "lodash-es";
import { useMemo } from "react";

import { useShallowMemo } from "@lichtblick/hooks";
import { SettingsTreeAction, SettingsTreeNode, SettingsTreeNodes } from "@lichtblick/suite";

import type { Config } from "./types";

export function settingsActionReducer(prevConfig: Config, action: SettingsTreeAction): Config {
  return produce(prevConfig, (draft) => {
    switch (action.action) {
      case "perform-node-action":
        throw new Error(`Unhandled node action: ${action.payload.id}`);
      case "update":
        switch (action.payload.path[0]) {
          case "general":
            _.set(draft, [action.payload.path[1]!], action.payload.value);
            break;
          default:
            throw new Error(`Unexpected payload.path[0]: ${action.payload.path[0]}`);
        }
        break;
    }
  });
}

const supportedDataTypes = [
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "float32",
  "float64",
  "string",
];

export function useSettingsTree(
  config: Config,
  pathParseError: string | undefined,
  error: string | undefined,
  legendCount: number,
): SettingsTreeNodes {
  const generalSettings = useMemo((): SettingsTreeNode => {
    const fields: SettingsTreeNode["fields"] = {
      path: {
        label: "Message path",
        input: "messagepath",
        value: config.path,
        error: pathParseError,
        validTypes: supportedDataTypes,
      },
      title: {
        label: "Title",
        input: "string",
        value: config.title,
      },
    };

    for (let i = 1; i <= legendCount; i++) {
      const key = `legend${i}` as const;
      fields[key] = {
        label: `Legend ${i}`,
        input: "string",
        value: config[key] ?? "",
      };
    }

    return {
      error,
      fields,
    };
  }, [config, pathParseError, error, legendCount]);

  return useShallowMemo({ general: generalSettings });
}
