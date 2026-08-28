// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `RawMessages` panel (panels/RawMessages). Config verified against panels/RawMessages:
 * topicPath plus the diff fields diffEnabled/diffMethod/diffTopicPath/showFullMessageForDiff and
 * fontSize. Any topic is accepted — this is the fallback when a path cannot be built.
 */
export const PANEL_RAW_MESSAGES_SKILL: Skill = {
  id: "panel-raw-messages",
  name: "RawMessages panel: raw message inspection",
  whenToUse: "Before proposing a layout that uses the RawMessages panel — any-schema inspection.",
  indexed: false,
  body: `# The \`RawMessages\` panel

MessagePath-based panel, but with **no type restriction**: any schema is accepted, and the panel
shows the full message tree. This makes it the fallback whenever a path cannot be built — see the
"never guess fields" rule in the panel-catalog skill.

\`\`\`json
{ "lichtblickPanelTitle": "Odometry message", "topicPath": "/nav/odom" }
\`\`\`

Optional diffing: \`diffEnabled\`, \`diffMethod\` (\`"custom"\` or \`"previous message"\`),
\`diffTopicPath\` (required when \`diffMethod\` is \`"custom"\`), \`showFullMessageForDiff\`, and
\`fontSize\` for display size.

The panel shows the latest message for the configured path; it has no per-message stepping.
For very large messages prefer the virtualized sibling \`RawMessagesVirtual\` (see
panel-raw-messages-virtual) — identical config.`,
};
