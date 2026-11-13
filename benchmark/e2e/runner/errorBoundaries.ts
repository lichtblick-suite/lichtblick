// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Error-boundary guard: a scenario whose panels (or the whole app) crashed into an error boundary
// measures an error screen, not the scenario. The runner checks the page once after measurement
// and fails the run with the rendered error texts.
//
// `ErrorDisplay` (packages/suite-base/src/components/ErrorDisplay.tsx) has no test id; its stable
// markers are the fixed title text and the error message in a `<code>` element
// (`Typography component="code"`), a sibling of the title's parent stack. The title is a
// `Typography variant="h4"`, but the theme (`packages/theme/src/components/MuiTypography.ts`)
// remaps all variants to `<div>`, so it is matched by its text node, not by tag:
//
//   <Stack><Stack><div>{title}</div><div>…</div></Stack><hr/><code>{error.message}</code>…</Stack>
//
// The titles to match are `ERROR_BOUNDARY_TITLES` (`runner/constants.ts`).

import type { ErrorBoundaryHit } from "./types";

/**
 * Collects the rendered error boundaries below `root`. Runs inside the page via
 * `page.evaluate(collectErrorBoundaryHits, ERROR_BOUNDARY_TITLES)`, so it must stay
 * self-contained (no imports, no closures over module scope).
 */
export function collectErrorBoundaryHits(
  titles: readonly string[],
  root: Node = document,
): ErrorBoundaryHit[] {
  // Ancestors searched for the message `<code>` (the title's grandparent holds it). Declared
  // inline: this function is serialized into the page.
  const searchDepth = 3;
  const hits: ErrorBoundaryHit[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node != undefined; node = walker.nextNode()) {
    const title = (node.textContent ?? "").trim();
    if (!titles.includes(title)) {
      continue;
    }
    let message = "";
    let ancestor = node.parentElement?.parentElement;
    for (let depth = 0; depth < searchDepth && ancestor != undefined; depth++) {
      const code = ancestor.querySelector("code");
      if (code != undefined) {
        message = code.textContent.trim();
        break;
      }
      ancestor = ancestor.parentElement;
    }
    hits.push({ title, message });
  }
  return hits;
}

/**
 * Failure message for the rendered error boundaries, or undefined if there are none. Identical
 * boundaries are grouped with a count, e.g.
 * `6× This panel encountered an unexpected error: Error creating WebGL context.`
 */
export function formatErrorBoundaryFailure({
  label,
  hits,
}: {
  label: string;
  hits: readonly ErrorBoundaryHit[];
}): string | undefined {
  if (hits.length === 0) {
    return undefined;
  }
  const counts = new Map<string, number>();
  for (const { title, message } of hits) {
    const line = message === "" ? title : `${title}: ${message}`;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const lines = Array.from(counts, ([line, count]) => `  - ${count}× ${line}`);
  const noun = hits.length === 1 ? "error boundary" : "error boundaries";
  return [
    `${label}: ${hits.length} ${noun} rendered, the run measured an error screen instead of the scenario:`,
    ...lines,
  ].join("\n");
}
