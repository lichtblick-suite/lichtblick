// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Static, dependency-free extraction of the topics a user script consumes and produces. The
 * LayoutPreviewCard must render this information without compiling the script (no TypeScript
 * worker in the card), so the extraction is deliberately simple: string-literal arrays for
 * `inputs` and a single string literal for `output`. Extraction failure degrades to undefined —
 * the card shows a "could not parse" placeholder instead of failing.
 */
export function extractInputTopics(sourceCode: string): readonly string[] | undefined {
  const arrayMatch = /export\s+const\s+inputs\s*=\s*\[([\s\S]*?)\]/m.exec(sourceCode);
  if (arrayMatch == undefined) {
    return undefined;
  }
  return [...arrayMatch[1]!.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]!);
}

export function extractOutputTopic(sourceCode: string): string | undefined {
  const outputMatch =
    /export\s+const\s+output\s*=\s*("([^"]+)"|'([^']+)')/m.exec(sourceCode);
  return outputMatch?.[2] ?? outputMatch?.[3];
}

export type UserScriptSummary = {
  id: string;
  name: string;
  sourceCode: string;
  inputTopics: readonly string[] | undefined;
  outputTopic: string | undefined;
};

export type UserScriptsData = Record<string, { name?: string; sourceCode?: string }>;

/**
 * Builds the ordered summary list for the scripts carried in a proposal's `userNodes`. Entries
 * with no usable source code are included (name/id only) so the user can still see that the
 * proposal carries a script; the card's parse placeholders handle the missing fields.
 */
export function summarizeUserScripts(userNodes: UserScriptsData | undefined): UserScriptSummary[] {
  if (userNodes == undefined) {
    return [];
  }
  return Object.keys(userNodes)
    .sort()
    .map((id) => {
      const entry = userNodes[id];
      const sourceCode = typeof entry?.sourceCode === "string" ? entry.sourceCode : "";
      return {
        id,
        name: typeof entry?.name === "string" && entry.name.length > 0 ? entry.name : id,
        sourceCode,
        inputTopics: sourceCode.length === 0 ? undefined : extractInputTopics(sourceCode),
        outputTopic: sourceCode.length === 0 ? undefined : extractOutputTopic(sourceCode),
      };
    });
}
