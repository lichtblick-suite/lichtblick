// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { transform } from "lodash";

import {
  SettingsTreeFields,
  SettingsTreeRoots,
} from "@foxglove/studio-base/components/SettingsTreeEditor/types";

// Persisted panel state
export type Config = {
  customTileUrl: string;
  disabledTopics: string[];
  layer: string;
  zoomLevel?: number;
};

export function validateCustomUrl(url: string): Error | undefined {
  const placeholders = url.match(/\{.+?\}/g) ?? [];
  const validPlaceholders = ["{x}", "{y}", "{z}"];
  for (const placeholder of placeholders) {
    if (!validPlaceholders.includes(placeholder)) {
      return new Error(`Invalid placeholder ${placeholder}`);
    }
  }

  return undefined;
}

export function buildSettingsTree(config: Config, eligibleTopics: string[]): SettingsTreeRoots {
  const topics: SettingsTreeFields = transform(
    eligibleTopics,
    (result, topic) => {
      result[topic] = {
        label: topic,
        input: "boolean",
        value: !config.disabledTopics.includes(topic),
      };
    },
    {} as SettingsTreeFields,
  );

  const generalSettings: SettingsTreeFields = {
    layer: {
      label: "Tile Layer",
      input: "select",
      value: config.layer,
      options: [
        { label: "Map", value: "map" },
        { label: "Satellite", value: "satellite" },
        { label: "Custom", value: "custom" },
      ],
    },
  };

  // Only show the custom url input when the user selects the custom layer
  if (config.layer === "custom") {
    let error: string | undefined;
    if (config.customTileUrl.length > 0) {
      error = validateCustomUrl(config.customTileUrl)?.message;
    }

    generalSettings.customTileUrl = {
      label: "Custom map tile URL",
      input: "string",
      value: config.customTileUrl,
      error,
    };
  }

  const settings: SettingsTreeRoots = {
    general: {
      label: "General",
      icon: "Settings",
      fields: generalSettings,
    },
    topics: {
      label: "Topics",
      fields: topics,
    },
  };

  return settings;
}
