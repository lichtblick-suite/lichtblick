// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SettingsTreeNodes, Topic } from "@foxglove/studio";

export function buildSettingsTree(
  topicToRender: string,
  availableTopics: Topic[],
): SettingsTreeNodes {
  const topicOptions = availableTopics.map((topic) => ({ label: topic.name, value: topic.name }));
  const topicIsAvailable = availableTopics.some((topic) => topic.name === topicToRender);
  if (!topicIsAvailable) {
    topicOptions.unshift({ value: topicToRender, label: topicToRender });
  }
  const topicError = topicIsAvailable ? undefined : `Topic ${topicToRender} is not available`;

  return {
    general: {
      icon: "Settings",
      fields: {
        topicToRender: {
          input: "select",
          label: "Topic",
          value: topicToRender,
          error: topicError,
          options: topicOptions,
        },
      },
    },
  };
}
