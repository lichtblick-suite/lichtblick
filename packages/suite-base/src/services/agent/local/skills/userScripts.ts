// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "./types";

/**
 * Risk decision (recorded per plan2 N7): user scripts execute through `new Function` inside a
 * SharedWorker without CPU or loop limits. This batch deliberately adds no execution timeout and
 * accepts the residual DoS risk — the user reviews the source in the layout card before applying.
 * The self-containment rules below (no fetch/network/external storage) are behavior conventions,
 * not security controls.
 */
export const USER_SCRIPTS_SKILL: Skill = {
  id: "user-scripts",
  name: "User scripts: deriving topics the panels need",
  whenToUse:
    "When the user needs a derived, transformed, or aggregated topic that no panel can produce alone.",
  body: `# User scripts

When no panel answers the question from the raw topics alone, propose a layout that includes a
user script. Scripts run inside the app's UserScriptPlayer: they subscribe to real topics and
publish derived messages under an output topic that the panels in the same layout consume.

## When to write a script

Use a script instead of a panel when the question needs:

- unit conversion (m/s → km/h, radians → degrees),
- field assembly or combining several topics (odometry + IMU),
- aggregation over messages (publish rate, counts, min/max over a window),
- any computation a message path alone cannot express.

## Format

Every script has exactly this shape:

\`\`\`ts
import { Input, Message } from "./types";

type Twist = Message<"geometry_msgs/TwistStamped">;

type Output = {
  speedKmh: number;
};

export const inputs = ["/odom"];

export const output = "/studio_script/speed_kmh";

export default function script(event: Input<"/odom">): Output {
  const twist: Twist = event.message;
  return { speedKmh: twist.twist.linear.x * 3.6 };
}
\`\`\`

Hard constraints:

- \`inputs\` must name real topics from the loaded catalog, spelled exactly as they appear
  there — never a topic guessed from memory.
- \`output\` must start with \`/studio_script/\`, must be unique within the layout, and must not
  collide with any data-source topic. The prefix exists exactly to prevent collisions.
- The default export receives an \`Input<"/topic">\` event (\`topic\`, \`receiveTime\`,
  \`message\`) and **must return an object with at least one field** — the script pipeline
  derives the output datatype from the return type, and a bare \`number\` or \`string\` return
  is rejected (BAD_TYPE_RETURN), which leaves the output topic untyped and its consumer panels
  empty. Use \`Message<"schema">\` only as a type (for example a typed return value); it is a
  type helper, not a runtime import.
- The script must be self-contained: no \`fetch\`, no network access, no external storage, no
  package imports. This is a behavior convention, not a security control.

## Proposing a layout with scripts

Scripts travel in the \`userNodes\` field of the layout proposal, keyed by a short unique id,
each with \`name\` and \`sourceCode\`:

\`\`\`json
"userNodes": {
  "speed-converter": { "name": "Speed km/h", "sourceCode": "…" }
}
\`\`\`

Layout validation enforces exactly \`{ name, sourceCode }\` per node — anything else is
rejected. When a proposal includes a script, also add panels that consume its \`output\` topic
(for example a Plot with a path starting with \`/studio_script/...\`), so the user sees the
derived value immediately. The user reviews the script source in the layout card before
applying, and can edit it later in the NodePlayground editor.

## Never propose the NodePlayground panel

The NodePlayground editor panel is not on the panel allowlist and must never be proposed:
scripts execute without it, and the user opens NodePlayground themselves when they want to
edit or debug a script. Propose layouts, not editors.

## Risk note

Scripts execute in a SharedWorker via \`new Function\` without CPU or loop limits, so a script
can stall or consume CPU. Never generate code that loops without bound; keep the source short
enough to review in the layout card before applying.`,
};
