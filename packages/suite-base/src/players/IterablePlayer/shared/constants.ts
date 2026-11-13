// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Intentionally dependency-free: the benchmark e2e runner (Node, no suite-base path aliases)
// imports this file directly. Do not add imports.

// Telemetry for MultiIterableSource (scope "pipeline", no labels). The instance runs
// inside the source worker in the product; its records reach the main thread through the
// WorkerSerializedIterableSource bridge.
export const SOURCES_TOTAL_METRIC = "pipeline.sources.total";
export const SOURCES_RELEVANT_METRIC = "pipeline.sources.relevant";

// Telemetry for HydratedSourcePool (scope "pipeline", label `{ poolId }`).
export const HYDRATED_SOURCE_POOL_METRIC_PREFIX = "pipeline.hydratedSourcePool.";

export const HYDRATED_SOURCE_POOL_GAUGE_METRICS = {
  residentCount: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}residentCount`,
  residentBytes: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}residentBytes`,
  pinnedEntries: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}pinnedEntries`,
  activePins: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}activePins`,
  overBudget: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}overBudget`,
  highWaterResidentCount: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}highWaterResidentCount`,
  highWaterResidentBytes: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}highWaterResidentBytes`,
  highWaterActivePins: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}highWaterActivePins`,
} as const;

// Integer event counters kept as plain numbers (overBudgetDurationMs is derived separately).
// Source of truth for `HydratedSourcePoolCounterKey` (shared/types.ts).
export const HYDRATED_SOURCE_POOL_COUNTER_KEYS = [
  "acquires",
  "releases",
  "terminatedPins",
  "opens",
  "rehydrations",
  "admits",
  "closes",
  "evictions",
  "failures",
  "overBudgetPeriods",
] as const;

// Precomputed so publishing never concatenates strings. `satisfies` enforces one metric per key.
export const HYDRATED_SOURCE_POOL_COUNTER_METRICS = {
  acquires: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}acquires`,
  releases: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}releases`,
  terminatedPins: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}terminatedPins`,
  opens: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}opens`,
  rehydrations: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}rehydrations`,
  admits: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}admits`,
  closes: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}closes`,
  evictions: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}evictions`,
  failures: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}failures`,
  overBudgetPeriods: `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}overBudgetPeriods`,
} as const satisfies Readonly<Record<(typeof HYDRATED_SOURCE_POOL_COUNTER_KEYS)[number], string>>;

export const HYDRATED_SOURCE_POOL_OVER_BUDGET_DURATION_METRIC = `${HYDRATED_SOURCE_POOL_METRIC_PREFIX}overBudgetDurationMs`;
