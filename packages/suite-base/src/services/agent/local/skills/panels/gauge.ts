// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `Gauge` panel (panels/Gauge). Config verified against panels/Gauge/types.ts: GaugeConfig is
 * colorMap/colorMode/gradient/maxValue/minValue/path/reverse; defaults are 0/1 for the range,
 * which pins any real-world signal unless minValue/maxValue are set.
 */
export const PANEL_GAUGE_SKILL: Skill = {
  id: "panel-gauge",
  name: "Gauge panel: single-value dial configuration",
  whenToUse: "Before proposing a layout that uses the Gauge panel — range and color config.",
  indexed: false,
  body: `# The \`Gauge\` panel

MessagePath-based panel: one numeric value on a dial. Single path.

\`\`\`json
{ "lichtblickPanelTitle": "Battery level", "path": "/battery.percentage", "minValue": 0, "maxValue": 100, "colorMode": "colormap", "colorMap": "red-yellow-green" }
\`\`\`

**Always set \`minValue\` and \`maxValue\` to the signal's real range.** They default to 0 and 1, so
any signal with a larger range pins the needle.

- \`colorMap\` is one of \`"red-yellow-green"\`, \`"rainbow"\`, \`"turbo"\`.
- \`colorMode\` is \`"colormap"\` (default) or \`"gradient"\`; \`gradient\` (exactly two color
  strings) applies only when \`colorMode\` is \`"gradient"\`.
- \`reverse\` (boolean) mirrors the color gradient so the start color sits at the high end of
  the dial; the pointer position is unaffected (it is computed from the value alone).
- Values must be numbers or numeric strings.

The path must resolve to a single numeric field — an array or object field renders nothing.`,
};
