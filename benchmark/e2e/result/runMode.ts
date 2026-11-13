// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Scenario runs vs telemetry overhead A/B runs (`run.mode`, see `RunModeV1`). Free of
// DOM/Playwright/Node imports (compiled by the root tsconfig through the CI summary).

import type { PersistedResultV1 } from "./schemaV1";

type ModeFields = { run: Pick<PersistedResultV1["run"], "mode">; summary: object };

/**
 * True for a run of the telemetry overhead A/B: `run.mode === "overhead"`, or, for results written
 * before `run.mode` existed, a `summary.steadyWindow` (only overhead runs measure one). A partial
 * result of a failed overhead run (no steady window) is still recognized by its `run.mode`.
 */
export function isOverheadRun({ run, summary }: ModeFields): boolean {
  if (run.mode != undefined) {
    return run.mode === "overhead";
  }
  return "steadyWindow" in summary && summary.steadyWindow != undefined;
}

/** The scenario runs among `results` (overhead A/B runs removed), order kept. */
export function scenarioRunsOnly<T extends ModeFields>(results: readonly T[]): T[] {
  return results.filter((result) => !isOverheadRun(result));
}
