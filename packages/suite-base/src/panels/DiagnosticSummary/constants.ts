// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  SettingsTreeField,
  SettingsTreeFieldBoolean,
  SettingsTreeFieldNumber,
  SettingsTreeFieldSelectString,
  SettingsTreeNodes,
} from "@lichtblick/suite";
import { DiagnosticSummaryConfig } from "@lichtblick/suite-base/panels/DiagnosticSummary/types";

// Trim the message if it's too long. We sometimes get crazy massive messages here that can
// otherwise crash our entire UI. I looked at a bunch of messages manually and they are typically
// way smaller than 5KB, so this is a very generous maximum. But feel free to increase it more if
// necessary. Exported for tests.
export const MAX_STRING_LENGTH = 5000; // 5KB

export const DEFAULT_SECONDS_UNTIL_STALE = 5; // ROS rqt_runtime_monitor default

export const LEVELS: { OK: 0; WARN: 1; ERROR: 2; STALE: 3 } = {
  OK: 0,
  WARN: 1,
  ERROR: 2,
  STALE: 3,
};

export const LEVEL_NAMES: Record<string, string> = {
  0: "ok",
  1: "warn",
  2: "error",
  3: "stale",
};

export const KNOWN_LEVELS = [0, 1, 2, 3];

export const ALLOWED_DATATYPES: string[] = [
  "diagnostic_msgs/DiagnosticArray",
  "diagnostic_msgs/msg/DiagnosticArray",
  "ros.diagnostic_msgs.DiagnosticArray",
];

export const MESSAGE_COLORS: Record<number, string> = {
  [LEVELS.OK]: "success.main",
  [LEVELS.ERROR]: "error.main",
  [LEVELS.WARN]: "warning.main",
  [LEVELS.STALE]: "text.secondary",
};

export const DEFAULT_CONFIG: DiagnosticSummaryConfig = {
  minLevel: 0,
  pinnedIds: [],
  hardwareIdFilter: "",
  topicToRender: "/diagnostics",
  sortByLevel: true,
};

export const DEFAULT_SETTINGS_TREE_NODE: SettingsTreeNodes = {
  general: {
    label: "General",
    fields: {
      topicToRender: {
        label: "Topic",
        input: "select",
        options: [],
      } as SettingsTreeField & SettingsTreeFieldSelectString,
      sortByLevel: { label: "Sort by level", input: "boolean" } as SettingsTreeField &
        SettingsTreeFieldBoolean,
      secondsUntilStale: {
        label: "Stale timeout",
        help: "Number of seconds after which entries will be marked as stale if no new diagnostic message(s) have been received",
        input: "number",
        placeholder: `${DEFAULT_SECONDS_UNTIL_STALE} seconds`,
        min: 0,
        step: 1,
        precision: 0,
      } as SettingsTreeField & SettingsTreeFieldNumber,
    },
  },
};
