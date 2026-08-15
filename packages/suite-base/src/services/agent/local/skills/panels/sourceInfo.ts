// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `SourceInfo` panel (panels/DataSourceInfo). Config verified against
 * panels/DataSourceInfo/index.tsx: `SourceInfo.defaultConfig = {}` — the config must be `{}`.
 */
export const PANEL_SOURCE_INFO_SKILL: Skill = {
  id: "panel-source-info",
  name: "SourceInfo panel: data source orientation",
  whenToUse: "Before proposing a layout that uses the SourceInfo panel — no-config constraint.",
  indexed: false,
  body: `# The \`SourceInfo\` panel

**No configuration:** the config must be \`{}\` except for the optional \`lichtblickPanelTitle\`
(a title is still shown in the toolbar and helps identify the panel). Any other config key is
ignored or rejected, so pass nothing else.

\`\`\`json
{ "configById": { "SourceInfo!info": { "lichtblickPanelTitle": "Data source" } } }
\`\`\`

Lists the data source, time range, and topic table. Useful as a small orientation panel when the
user is exploring an unfamiliar recording — for example at the top of a replay-analysis layout so
the source and time range stay visible. It consumes no topics of its own.

See the panel-catalog skill for when an orientation panel fits a layout.`,
};
