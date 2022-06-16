// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEmpty } from "lodash";

import { Topic } from "@foxglove/studio";
import { SettingsTreeRoots } from "@foxglove/studio-base/components/SettingsTreeEditor/types";

import { Config } from "./types";

export function buildSettingsTree(config: Config, topics: readonly Topic[]): SettingsTreeRoots {
  const manualControl = isEmpty(config.jointStatesTopic);
  const topicOptions = topics.map((topic) => ({ label: topic.name, value: topic.name }));

  // Insert our selected topic into the options list even if it's not in the
  // list of available topics.
  if (
    config.jointStatesTopic != undefined &&
    config.jointStatesTopic !== "" &&
    !topics.some((topic) => topic.name === config.jointStatesTopic)
  ) {
    topicOptions.unshift({ label: config.jointStatesTopic, value: config.jointStatesTopic });
  }

  const settings: SettingsTreeRoots = {
    general: {
      icon: "Settings",
      fields: {
        manualControl: {
          label: "Manual Control",
          input: "boolean",
          value: manualControl,
        },
        jointStatesTopic: manualControl
          ? undefined
          : {
              input: "select",
              label: "Topic",
              value: config.jointStatesTopic,
              options: topicOptions,
            },
      },
    },
  };

  return settings;
}
