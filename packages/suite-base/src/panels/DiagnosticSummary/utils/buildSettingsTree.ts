// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  SettingsTreeField,
  SettingsTreeFieldBoolean,
  SettingsTreeFieldNumber,
  SettingsTreeFieldSelectString,
  SettingsTreeNodes,
} from "@lichtblick/suite";
import { DEFAULT_SETTINGS_TREE_NODE } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import { DiagnosticSummaryConfig } from "@lichtblick/suite-base/panels/DiagnosticSummary/types";

export type BuildSettingsTreeProps = {
  config: DiagnosticSummaryConfig;
  topicToRender: string;
  availableTopics: readonly string[];
};

export function buildSettingsTree({
  availableTopics,
  config,
  topicToRender,
}: BuildSettingsTreeProps): SettingsTreeNodes {
  const topicOptions = availableTopics.map((topic) => ({ label: topic, value: topic }));
  const topicIsAvailable = availableTopics.includes(topicToRender);

  if (!topicIsAvailable) {
    topicOptions.unshift({ value: topicToRender, label: topicToRender });
  }
  const topicError = topicIsAvailable ? undefined : `Topic ${topicToRender} is not available`;

  return {
    general: {
      ...DEFAULT_SETTINGS_TREE_NODE.general,
      fields: {
        topicToRender: {
          ...DEFAULT_SETTINGS_TREE_NODE.general?.fields?.topicToRender,
          value: topicToRender,
          error: topicError,
          options: topicOptions,
        } as SettingsTreeField & SettingsTreeFieldSelectString,
        sortByLevel: {
          ...DEFAULT_SETTINGS_TREE_NODE.general?.fields?.sortByLevel,
          value: config.sortByLevel,
        } as SettingsTreeField & SettingsTreeFieldBoolean,
        secondsUntilStale: {
          ...DEFAULT_SETTINGS_TREE_NODE.general?.fields?.secondsUntilStale,
          value: config.secondsUntilStale,
        } as SettingsTreeField & SettingsTreeFieldNumber,
      },
    },
  };
}
