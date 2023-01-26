// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SettingsTreeNodes } from "@foxglove/studio";

import { DiagnosticSummaryConfig } from "./util";

export function buildSummarySettingsTree(
  config: DiagnosticSummaryConfig,
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
        sortByLevel: { label: "Sort By Level", input: "boolean", value: config.sortByLevel },
      },
    },
  };
}

export function buildStatusPanelSettingsTree(
  topicToRender: string,
  numericPrecision: number | undefined,
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
          value: numericPrecision,
        },
      },
    },
  };
}
