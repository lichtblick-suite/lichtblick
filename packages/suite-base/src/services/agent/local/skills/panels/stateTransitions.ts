// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `StateTransitions` panel (panels/StateTransitions). Config verified against
 * panels/StateTransitions/index.tsx: defaultConfig is `{ paths: [], isSynced: true }`; the paths
 * shape matches Plot, but accepted values are numbers, strings, bigints and booleans — arrays are
 * invalid.
 */
export const PANEL_STATE_TRANSITIONS_SKILL: Skill = {
  id: "panel-state-transitions",
  name: "StateTransitions panel: discrete state changes over time",
  whenToUse: "Before proposing a layout that uses the StateTransitions panel — discrete paths.",
  indexed: false,
  body: `# The \`StateTransitions\` panel

MessagePath-based panel: shows how a discrete value changes over time. Same \`paths\` shape as
Plot.

Accepted values: number, string, bigint, boolean. A path that resolves to an array is invalid.
Best suited to enums, modes, and status flags — for continuous numeric trends use \`Plot\` instead
(see panel-plot).

\`\`\`json
{ "lichtblickPanelTitle": "Navigation mode", "paths": [{ "value": "/nav/state.mode", "timestampMethod": "receiveTime" }] }
\`\`\`

\`enabled\` is optional here; \`timestampMethod\` should still be set. Panel-level \`isSynced\`
(boolean, default \`true\`) ties the chart to the playback cursor.

On recorded data the panel supports click-to-seek; on live data timeline navigation is
unavailable.`,
};
