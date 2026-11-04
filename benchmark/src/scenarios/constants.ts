// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of runtime imports: also read by the Playwright runner and the result schema (`benchmark/e2e`).

/** Page URL param prefix for data source param overrides (`?ds.<param>=<value>`). */
export const DS_PARAM_PREFIX = "ds.";

/**
 * `?scenario.durationMs=<ms>` overrides the scenario's auto-pause duration (`Scenario.durationMs`)
 * when it is a positive finite number. The descriptor reports the effective value.
 */
export const SCENARIO_DURATION_MS_PARAM = "scenario.durationMs";

/**
 * Scenario groups (`Scenario.group`, `ScenarioDescriptor.group`): what a scenario mainly stresses.
 * Reports group and compare scenarios by it.
 */
export const SCENARIO_GROUPS = [
  "3d-rendering",
  "time-series",
  "preloading",
  "real-pipeline-ingest",
] as const;

/** Tag vocabulary of the registry (`Scenario.tags`). Extend when a scenario needs a new tag. */
export const SCENARIO_TAGS = [
  "3d",
  "pointcloud",
  "plot",
  "raw-messages",
  "tf",
  "preloading",
  "real-pipeline",
  "mcap",
  "synthetic",
] as const;

/** Replaces scenario param values that may carry URLs or secrets in `ScenarioDescriptor.params`. */
export const REDACTED_PARAM_VALUE = "<redacted>";

/** Param names (lowercase) whose values are always redacted in `ScenarioDescriptor.params`. */
export const SECRET_PARAM_NAMES: ReadonlySet<string> = new Set([
  "url",
  "urls",
  "token",
  "key",
  "secret",
  "password",
]);

/** Value prefixes (lowercase) that make a param value redacted in `ScenarioDescriptor.params`. */
export const REDACTED_VALUE_PREFIXES: readonly string[] = [
  "http://",
  "https://",
  "blob:",
  "file:",
  "data:",
];
