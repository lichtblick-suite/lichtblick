// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `RawMessagesVirtual` panel (panels/RawMessagesVirtual). Config verified against
 * panels/RawMessagesVirtual/RawMessagesVirtual.tsx: identical shape to RawMessages (topicPath,
 * diff fields, fontSize) — only the rendering is virtualized.
 */
export const PANEL_RAW_MESSAGES_VIRTUAL_SKILL: Skill = {
  id: "panel-raw-messages-virtual",
  name: "RawMessagesVirtual panel: virtualized message inspection",
  whenToUse: "Before proposing a layout that uses the RawMessagesVirtual panel — large messages.",
  indexed: false,
  body: `# The \`RawMessagesVirtual\` panel

The virtualized variant of \`RawMessages\`: same config, same any-schema message-tree rendering,
but rows are rendered on demand. Prefer it for large messages or topics with many fields, where
the plain \`RawMessages\` panel would render the whole tree eagerly.

\`\`\`json
{ "lichtblickPanelTitle": "Odometry message", "topicPath": "/nav/odom" }
\`\`\`

Identical optional diffing fields as \`RawMessages\`: \`diffEnabled\`, \`diffMethod\`
(\`"custom"\` or \`"previous message"\`), \`diffTopicPath\`, \`showFullMessageForDiff\`, plus
\`fontSize\`. Any schema is accepted, so this panel is also a valid fallback when a message path
cannot be built — see the "never guess fields" rule in the panel-catalog skill.

For the non-virtualized behavior and diff semantics, see panel-raw-messages.`,
};
