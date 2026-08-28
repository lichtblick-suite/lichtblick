// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `map` panel (panels/Map). Config verified against panels/Map/config.ts: Config is
 * center/customTileUrl/disabledTopics/followTopic/layer/topicColors/zoomLevel/maxNativeZoom;
 * eligible schemas are NavSatFix, LocationFix and GeoJSON with their name variants.
 */
export const PANEL_MAP_SKILL: Skill = {
  id: "panel-map",
  name: "map panel: geographic position and GeoJSON overlays",
  whenToUse: "Before proposing a layout that uses the map panel — layer and follow rules.",
  indexed: false,
  body: `# The \`map\` panel

Topic-based panel: geographic positions and GeoJSON overlays. Accepts exactly these schemas (with
their name variants): \`sensor_msgs/NavSatFix\`, \`foxglove.LocationFix\`, \`foxglove.GeoJSON\`.

All eligible topics are drawn unless listed in \`disabledTopics\`.

\`\`\`json
{ "lichtblickPanelTitle": "GPS position", "layer": "map", "followTopic": "/gps/fix", "disabledTopics": [], "topicColors": {} }
\`\`\`

- \`layer\` is \`"map"\`, \`"satellite"\`, or \`"custom"\`. With \`"custom"\`, \`customTileUrl\` may
  only contain \`{x}\`, \`{y}\`, \`{z}\` placeholders.
- \`followTopic\` cannot be a GeoJSON topic.
- \`topicColors\` maps topic names to CSS color strings.
- Optional view state: \`center\` (\`{ lat, lon }\`), \`zoomLevel\`, \`maxNativeZoom\`.
- Points are plotted only when latitude and longitude are finite.

For robot localization, prefer pairing the \`map\` panel with a \`3D\` or robot panel rather than
overloading one view — see the panel-catalog skill.`,
};
