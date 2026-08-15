// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `PieChart` panel (panels/PieChart). Config verified against panels/PieChart/types.ts:
 * `{ path, title, legend1..legendN }`. The strongest constraint: the path must resolve to a
 * `float32[]` array — anything else renders an empty chart (verified from the panel source, which
 * disagrees with its own settings-tree filter).
 */
export const PANEL_PIE_CHART_SKILL: Skill = {
  id: "panel-pie-chart",
  name: "PieChart panel: float32[] distribution chart",
  whenToUse: "Before proposing a layout that uses the PieChart panel — float32[] requirement.",
  indexed: false,
  body: `# The \`PieChart\` panel

MessagePath-based panel: **strongest constraint of any panel — the path must resolve to a
\`float32[]\` array.** Anything else — a plain number, a \`float64[]\`, an \`int32[]\` — renders an
empty chart. Do not propose this panel unless the catalog shows a \`float32\` array field.

Values are normalized to percentages of their sum. Slice labels come from \`legend1\`…\`legendN\`.

\`\`\`json
{ "lichtblickPanelTitle": "Fault distribution", "path": "/diagnostics.distribution", "title": "Fault distribution", "legend1": "Nav", "legend2": "Perception" }
\`\`\`

For non-\`float32\` distributions, offer \`Plot\` or \`Table\` instead — see the panel-catalog
skill for the routing rules.`,
};
