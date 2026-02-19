// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SettingsTreeNodes } from "@lichtblick/suite";
import { DiagnosticStatusConfig } from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { DEFAULT_SECONDS_UNTIL_STALE } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";

export function buildStatusPanelSettingsTree(
  config: DiagnosticStatusConfig,
  topicToRender: string,
  availableTopics: readonly string[],
): SettingsTreeNodes {
  const topicOptions = availableTopics.map((topic) => ({ label: topic, value: topic }));
  const topicIsAvailable = availableTopics.includes(topicToRender);
  if (!topicIsAvailable) {
    topicOptions.unshift({ value: topicToRender, label: topicToRender });
  }
  const topicError = topicIsAvailable ? undefined : `Topic ${topicToRender} is not available`;

  return {
    general: {
      label: "General",
      fields: {
        topicToRender: {
          label: "Topic",
          input: "select",
          value: topicToRender,
          error: topicError,
          options: topicOptions,
        },
        numericPrecision: {
          label: "Numeric precision",
          input: "number",
          min: 0,
          max: 17,
          precision: 0,
          step: 1,
          placeholder: "auto",
          value: config.numericPrecision,
        },
        secondsUntilStale: {
          label: "Stale timeout",
          help: "Number of seconds after which entries will be marked as stale if no new diagnostic message(s) have been received",
          input: "number",
          placeholder: `${DEFAULT_SECONDS_UNTIL_STALE} seconds`,
          min: 0,
          step: 1,
          precision: 0,
          value: config.secondsUntilStale,
        },
      },
    },
  };
}
