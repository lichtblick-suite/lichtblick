// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TFunction } from "i18next";

import { SettingsTreeChildren, SettingsTreeNodes } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";

import { LogLevel } from "./types";

// Create the log level options nodes once since they don't change per render.
const LOG_LEVEL_OPTIONS = [
  { label: ">= DEBUG", value: LogLevel.DEBUG },
  { label: ">= INFO", value: LogLevel.INFO },
  { label: ">= WARN", value: LogLevel.WARN },
  { label: ">= ERROR", value: LogLevel.ERROR },
  { label: ">= FATAL", value: LogLevel.FATAL },
];

export function buildSettingsTree(
  topicToRender: string,
  minLogLevel: number,
  nameFilter: Record<string, { visible?: boolean }>,
  availableTopics: Topic[],
  availableNames: string[],
  t: TFunction<"log">,
): SettingsTreeNodes {
  const topicOptions = availableTopics.map((topic) => ({ label: topic.name, value: topic.name }));
  const topicIsAvailable = availableTopics.some((topic) => topic.name === topicToRender);
  if (!topicIsAvailable) {
    topicOptions.unshift({ value: topicToRender, label: topicToRender });
  }
  const topicError = topicIsAvailable ? undefined : t("topicError", { topic: topicToRender });
  const nodeChildren: SettingsTreeChildren = Object.fromEntries(
    availableNames.map((name) => [
      name,
      {
        label: name,
        visible: nameFilter[name]?.visible ?? true,
      },
    ]),
  );

  return {
    general: {
      fields: {
        topicToRender: {
          input: "select",
          label: t("topic"),
          value: topicToRender,
          error: topicError,
          options: topicOptions,
        },
        minLogLevel: {
          input: "select",
          label: t("minLogLevel"),
          value: minLogLevel,
          options: LOG_LEVEL_OPTIONS,
        },
      },
    },
    nameFilter: {
      enableVisibilityFilter: true,
      children: nodeChildren,
      label: t("nameFilter"),
      actions: [
        { id: "show-all", type: "action", label: t("showAll") },
        { id: "hide-all", type: "action", label: t("hideAll") },
      ],
    },
  };
}
