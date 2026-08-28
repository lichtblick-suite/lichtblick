// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `Plot` panel (panels/Plot). Config verified against panels/Plot/utils/config.ts: PlotPath
 * requires value/enabled/timestampMethod; the paths array replaces the default wholesale; a
 * numeric `value` becomes a horizontal reference line rather than a series.
 */
export const PANEL_PLOT_SKILL: Skill = {
  id: "panel-plot",
  name: "Plot panel: time-series configuration",
  whenToUse: "Before proposing a layout that uses the Plot panel — path rules and axis config.",
  indexed: false,
  body: `# The \`Plot\` panel

MessagePath-based panel: configured with message-path strings such as
\`/imu/data.linear_acceleration.x\`. The path must resolve to a value of the type the panel wants.

Time-series lines from numeric message paths.

Value types: \`bool\`, \`int8\`–\`int64\`, \`uint8\`–\`uint64\`, \`float32\`, \`float64\`, \`string\`,
\`time\`, \`duration\`. Fields that terminate in a message or an unsliced array are not plottable.

**Every path must be self-contained.** The \`paths\` array replaces the default wholesale; it is not
merged per-field. A path missing \`enabled\` is falsy and draws nothing.

\`\`\`json
{
  "lichtblickPanelTitle": "IMU acceleration",
  "paths": [
    { "value": "/imu/data.linear_acceleration.x", "enabled": true, "timestampMethod": "receiveTime" }
  ]
}
\`\`\`

Useful optional per-path fields: \`label\`, \`color\`, \`lineSize\`, \`showLine\`. Panel-level:
\`xAxisVal\` (\`"timestamp"\` default, or \`"index"\`, \`"custom"\`, \`"currentCustom"\`),
\`showLegend\`, \`legendDisplay\` (\`"floating"\`, \`"top"\`, \`"left"\`, \`"none"\`),
\`minYValue\`, \`maxYValue\`, \`isSynced\`, \`xAxisPath\`.

**Trap:** a \`value\` that parses as a number is treated as a horizontal reference line, not a
series. Use a real message path.

**Multiple curves:** prefer one Plot panel with all series in its \`paths\` array (one entry per
curve). Split into several Plot panels only when the series have conflicting units, value ranges,
or axis semantics that cannot share one panel.

**Trap:** a path that resolves to a \`string\` draws a line only when the string values are
plottable as discrete labels; for enums and modes prefer \`StateTransitions\` (see
panel-state-transitions).`,
};
