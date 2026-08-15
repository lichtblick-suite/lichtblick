// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `RosOut` panel (panels/Log). Every claim verified against panels/Log: the eight exact
 * schema names matched with `includes` (never convertibleTo), and Config from panels/Log/types.ts
 * (searchTerms, minLogLevel, optional topicToRender, optional nameFilter) with default
 * `{ searchTerms: [], minLogLevel: 1 }`.
 */
export const PANEL_ROSOUT_SKILL: Skill = {
  id: "panel-rosout",
  name: "RosOut panel: ROS log message filtering",
  whenToUse: "Before proposing a layout that uses the RosOut panel — exact Log schemas and filters.",
  indexed: false,
  body: `# The \`RosOut\` panel

ROS log messages, filtered by level and search terms. Accepts exactly these eight schema names —
matched exactly, never through \`convertibleTo\`:

\`\`\`
foxglove_msgs/Log
foxglove_msgs/msg/Log
foxglove.Log
foxglove::Log
rcl_interfaces/msg/Log
ros.rcl_interfaces.Log
ros.rosgraph_msgs.Log
rosgraph_msgs/Log
\`\`\`

**RosOut is the exception** to the general rule that a topic qualifies through its
\`convertibleTo\` list; only these eight schema names match, and nothing else. A topic whose
schema merely converts to one of these does not qualify; the schema name must be one of the eight
exactly.

\`\`\`json
{ "lichtblickPanelTitle": "Logs", "topicToRender": "/rosout", "minLogLevel": 2, "searchTerms": ["wheel"], "nameFilter": {} }
\`\`\`

- \`topicToRender\` (optional): the topic to display. When omitted, the first available topic with a
  supported schema is used; with none, the panel falls back to \`/rosout\`.
- \`minLogLevel\` (default \`1\`): drops messages below this level (DEBUG=1, INFO=2, WARN=3,
  ERROR=4, FATAL=5).
- \`searchTerms\` (default \`[]\`): case-insensitive substrings matched against node name and
  message text.
- \`nameFilter\` (optional): \`{ "<node-name>": { "visible": false } }\` hides messages from that
  node.

A bare \`{}\` config is valid: it renders the first supported log topic with no filtering.`,
};
