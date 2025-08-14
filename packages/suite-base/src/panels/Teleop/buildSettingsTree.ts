// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SettingsTreeNode, SettingsTreeNodes, Topic } from "@lichtblick/suite";
import { geometryMsgOptions } from "@lichtblick/suite-base/panels/Teleop/constants";
import { TeleopConfig } from "@lichtblick/suite-base/panels/Teleop/types";

export function buildSettingsTreeTeleop(
  config: TeleopConfig,
  topics: readonly Topic[],
): SettingsTreeNodes {
  const general: SettingsTreeNode = {
    label: "General",
    fields: {
      publishRate: { label: "Publish rate", input: "number", value: config.publishRate },
      topic: {
        label: "Topic",
        input: "autocomplete",
        value: config.topic,
        items: topics.map((t) => t.name),
      },
    },
    children: {
      upButton: {
        label: "Up Button",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.upButton.field,
            options: geometryMsgOptions,
          },
          value: { label: "Value", input: "number", value: config.upButton.value },
        },
      },
      downButton: {
        label: "Down Button",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.downButton.field,
            options: geometryMsgOptions,
          },
          value: { label: "Value", input: "number", value: config.downButton.value },
        },
      },
      leftButton: {
        label: "Left Button",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.leftButton.field,
            options: geometryMsgOptions,
          },
          value: { label: "Value", input: "number", value: config.leftButton.value },
        },
      },
      rightButton: {
        label: "Right Button",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.rightButton.field,
            options: geometryMsgOptions,
          },
          value: { label: "Value", input: "number", value: config.rightButton.value },
        },
      },
    },
  };

  return { general };
}
