// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2024-2025 Yukihiro Saito <yukky.saito@gmail.com>
// SPDX-License-Identifier: MPL-2.0
import { useMemo } from "react";

import { useShallowMemo } from "@lichtblick/hooks";
import { SettingsTreeNode, SettingsTreeNodes } from "@lichtblick/suite";

import { SUPPORTED_DATA_TYPES } from "./constants";
import type { PieChartConfig } from "./types";

export type UseSettingsTreeProps = {
  config: PieChartConfig;
  pathParseError?: string;
  error?: string;
  legendCount: number;
};

export function useSettingsTree({
  config,
  pathParseError,
  error,
  legendCount,
}: UseSettingsTreeProps): SettingsTreeNodes {
  const generalSettings = useMemo((): SettingsTreeNode => {
    const fields: SettingsTreeNode["fields"] = {
      legendControls: {
        label: "Legend controls",
        input: "legendcontrols",
      },
      path: {
        label: "Message path",
        input: "messagepath",
        value: config.path,
        error: pathParseError,
        validTypes: SUPPORTED_DATA_TYPES,
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
