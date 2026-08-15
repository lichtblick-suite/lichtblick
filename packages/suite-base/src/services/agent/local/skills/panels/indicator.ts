// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `Indicator` panel (panels/Indicator). Config verified against panels/Indicator/types.ts:
 * IndicatorConfig is fallbackColor/fallbackLabel/path/rules/style; rawValue is always a string
 * and rules are evaluated in order, first match wins. The path must resolve to a scalar
 * (panels/Indicator/Indicator.tsx maps a resolved message object to undefined, so a topic root
 * such as `/std_msgs_bool_topic` shows only the fallback — use `/topic.data`).
 */
export const PANEL_INDICATOR_SKILL: Skill = {
  id: "panel-indicator",
  name: "Indicator panel: rule-driven status light",
  whenToUse: "Before proposing a layout that uses the Indicator panel — rule semantics.",
  indexed: false,
  body: `# The \`Indicator\` panel

MessagePath-based panel: a colored state light driven by rules. Single path.

Accepts boolean, number, string, bigint — the path must resolve to the scalar field itself.
Pointing at a topic root (e.g. \`/std_msgs_bool_topic\`) resolves to the message object, which
this panel treats as no value and renders as the fallback color/label only — use
\`/std_msgs_bool_topic.data\` instead.

\`\`\`json
{
  "lichtblickPanelTitle": "System health",
  "path": "/system/healthy.data",
  "style": "bulb",
  "fallbackColor": "#a0a0a0",
  "fallbackLabel": "Unknown",
  "rules": [
    { "operator": "=", "rawValue": "true", "color": "#68e24a", "label": "Healthy" },
    { "operator": "=", "rawValue": "false", "color": "#e2564a", "label": "Fault" }
  ]
}
\`\`\`

**\`rawValue\` is always a string**, including for numeric comparisons — write \`"0.5"\`, not \`0.5\`.
Operators: \`=\`, \`<\`, \`<=\`, \`>\`, \`>=\`. Rules are evaluated in order and the first match wins;
if none match, the fallback color and label show. \`style\` is \`"bulb"\` or \`"background"\`.

An empty \`rules\` array shows only the fallback state — for a plain status light without
comparison rules, still include at least one rule so the panel is informative.`,
};
