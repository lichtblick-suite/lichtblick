// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `Table` panel (panels/Table). Config verified against panels/Table/index.tsx: the config
 * is exactly `{ topicPath }`; rendering requires the path to resolve to an object or an array of
 * objects, otherwise the table is empty.
 */
export const PANEL_TABLE_SKILL: Skill = {
  id: "panel-table",
  name: "Table panel: object-path table rendering",
  whenToUse: "Before proposing a layout that uses the Table panel — object-path requirement.",
  indexed: false,
  body: `# The \`Table\` panel

MessagePath-based panel with exactly one config field: \`topicPath\`.

\`\`\`json
{ "lichtblickPanelTitle": "Diagnostics status", "topicPath": "/diagnostics.status" }
\`\`\`

Latest message rendered as a table. The path must resolve to an **object or an array of objects**;
a scalar (number, string, boolean) or a flat value array renders an empty table. An array of
scalars is not tabular either — point it at the object array, e.g. \`/diagnostics/status_array\`
or \`/topic.objects\`.

For object-list inspection of a topic, prefer \`Table\` over \`RawMessages\` when the user wants a
structured view; use \`RawMessages\` when they want the raw tree. See the panel-catalog skill for
the routing rules.`,
};
