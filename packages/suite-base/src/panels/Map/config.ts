// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { filterMap } from "@lichtblick/den/collection";
import { SettingsTreeFields, SettingsTreeNodes, Topic } from "@lichtblick/suite";
import { MapMarkerStyle } from "@lichtblick/suite-base/panels/Map/types";

// Persisted panel state
export type Config = {
  center?: { lat: number; lon: number };
  customTileUrl: string;
  disabledTopics: string[];
  followTopic: string;
  layer: string;
  topicColors: Record<string, string>;
  zoomLevel?: number;
  maxNativeZoom?: number;
  markerStyle?: MapMarkerStyle;
  markerColor?: string;
  rotateWithHeading?: boolean;
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

function isGeoJSONSchema(schemaName: string) {
  switch (schemaName) {
    case "foxglove_msgs/GeoJSON":
    case "foxglove_msgs/msg/GeoJSON":
    case "foxglove::GeoJSON":
    case "foxglove.GeoJSON":
      return true;
    default:
      return false;
  }
}

export function buildSettingsTree(
  config: Config,
  eligibleTopics: Omit<Topic, "datatype">[],
): SettingsTreeNodes {
  const topics: SettingsTreeNodes = _.transform(
    eligibleTopics,
    (result, topic) => {
      const coloring = config.topicColors[topic.name];
      result[topic.name] = {
        label: topic.name,
        fields: {
          enabled: {
            label: "Enabled",
            input: "boolean",
            value: !config.disabledTopics.includes(topic.name),
          },
          coloring: {
            label: "Coloring",
            input: "select",
            value: coloring ? "Custom" : "Automatic",
            options: [
              { label: "Automatic", value: "Automatic" },
              { label: "Custom", value: "Custom" },
            ],
          },
          color: coloring
            ? {
                label: "Color",
                input: "rgb",
                value: coloring,
              }
            : undefined,
        },
      };
    },
    {} as SettingsTreeNodes,
  );

  const eligibleFollowTopicOptions = filterMap(eligibleTopics, (topic) =>
    config.disabledTopics.includes(topic.name) || isGeoJSONSchema(topic.schemaName)
      ? undefined
      : { label: topic.name, value: topic.name },
  );
  const followTopicOptions = [{ label: "Off", value: "" }, ...eligibleFollowTopicOptions];
  const generalSettings: SettingsTreeFields = {
    layer: {
      label: "Tile layer",
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

    generalSettings.maxNativeZoom = {
      label: "Max tile level",
      input: "select",
      value: config.maxNativeZoom,
      options: [18, 19, 20, 21, 22, 23, 24].map((num) => {
        return { label: String(num), value: num };
      }),
      help: "Highest zoom supported by the custom map source. See https://leafletjs.com/examples/zoom-levels/ for more information.",
    };
  }

  generalSettings.markerStyle = {
    label: "Position marker",
    input: "select",
    value: config.markerStyle ?? "dot",
    options: [
      { label: "Dot", value: "dot" },
      { label: "Arrow", value: "arrow" },
      { label: "Vehicle", value: "vehicle" },
    ],
    help: "Shape drawn at the current position. The oriented styles point along the direction of travel, derived from preceding fixes, and fall back to a dot while stationary.",
  };

  // Only offered for the oriented styles. A dot is drawn in the topic colour, and a colour
  // field that silently did nothing would be worse than no field at all.
  if (config.markerStyle != undefined && config.markerStyle !== "dot") {
    generalSettings.markerColoring = {
      label: "Marker coloring",
      input: "select",
      value: config.markerColor == undefined ? "Automatic" : "Custom",
      options: [
        { label: "Automatic", value: "Automatic" },
        { label: "Custom", value: "Custom" },
      ],
      help: "Automatic draws the marker in the same colour as its track.",
    };

    if (config.markerColor != undefined) {
      generalSettings.markerColor = {
        label: "Marker color",
        input: "rgb",
        value: config.markerColor,
      };
    }
  }

  generalSettings.followTopic = {
    label: "Follow topic",
    input: "select",
    value: config.followTopic,
    options: followTopicOptions,
  };

  // Only offered once a topic is being followed. Rotation needs a fix to take its bearing
  // from, so without one the toggle would do nothing.
  if (config.followTopic !== "") {
    generalSettings.rotateWithHeading = {
      label: "Rotate with heading",
      input: "boolean",
      value: config.rotateWithHeading ?? false,
      help: "Turn the map so the followed topic's direction of travel points up. North is shown by the compass.",
    };
  }

  const settings: SettingsTreeNodes = {
    general: {
      label: "General",
      fields: generalSettings,
    },
    topics: {
      label: "Topics",
      children: topics,
    },
  };

  return settings;
}
