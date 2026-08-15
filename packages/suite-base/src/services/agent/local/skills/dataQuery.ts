// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "./types";

/**
 * Indexed skill: reading the loaded data and controlling playback are core capabilities the
 * system prompt advertises, so this stays in the prompt index.
 */
export const DATA_QUERY_SKILL: Skill = {
  id: "data-query",
  name: "Reading loaded messages and playback control",
  whenToUse:
    "Before reading or searching loaded messages, or controlling playback.",
  body: `# Reading loaded data and playback control

The tools \`read_messages\`, \`search_messages\`, and \`playback_control\` operate on the data
source currently loaded in the workspace. They cannot read anything that is not loaded, and they
cannot load data themselves — use \`open_data_source\` first and wait for catalog-ready.

## read_messages

Read messages of one topic in receive order.

\`read_messages({ topic, start?, end?, limit? })\` — a single JSON object:

- \`topic\`: a topic from the loaded catalog.
- \`start\`/\`end\`: optional time bounds — decimal nanoseconds (see Time format below).
- \`limit\`: 1–100 messages to return (default 100).

Example: \`read_messages({ topic: "/imu", limit: 20 })\`.

The scan is capped at 50,000 messages and the returned payloads at a byte budget; oversized
messages are summarized and the result is marked \`truncated\` when the budget runs out. Results
carry \`scanned\` so you know how much was looked at.

## search_messages

Search one topic for messages matching \`text\` (case-insensitive substring) and/or \`level\`
(one of \`debug\`, \`info\`, \`warn\`, \`error\`, \`fatal\`, \`unknown\`). At least one of the two is
required; when both are given they are ANDed. \`limit\` is 1–20 hits (default 20). The same
50,000-message scan cap and byte budgets apply.

Log schemas (\`foxglove_msgs/Log\`, \`rcl_interfaces/msg/Log\`, \`rosgraph_msgs/Log\` and their
aliases) are matched on the normalized message text and level. Other schemas are matched on the
serialized payload text.

Every hit reports \`receiveTimeNs\` — the seekable receive time. Use that time for seeking, not
the message-internal stamp.

## playback_control

\`playback_control({ action, time? })\` — a single JSON object:

- \`action: "seek"\` requires \`time\` (decimal nanoseconds). The requested time is clamped to the
  loaded data range; the tool returns the accepted clamped target as \`acceptedTimeNs\`. The player
  state backfills asynchronously, so the returned value is the accepted request — do not claim the
  playback head is already there.
- \`action: "play"\` / \`"pause"\`: no time needed.

## Finding the first error

To jump to the first error in a log topic:

1. \`search_messages({ topic: "/rosout", level: "error", limit: 1 })\`
2. \`playback_control({ action: "seek", time: <hit.receiveTimeNs> })\`

## Live sources

Only iterable recordings support \`read_messages\` and \`search_messages\`. A live source returns a
clear error — do not retry or pretend the data was read. Playback control may also be unavailable
for a given player; the tool reports per-action which control is missing.

## Time format

All times are decimal nanoseconds as strings (e.g. \`"1672531200000000042"\`). Convert seconds to
nanoseconds by multiplying by 1e9. Resolve relative times ("a minute ago") against the current
time first; never pass relative words or unit strings.`,
};
