// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too). Product metric names are
// imported by relative path so no `@lichtblick/suite-base` path alias is needed.

import { PIPELINE_TELEMETRY_METRICS } from "../../../packages/suite-base/src/components/MessagePipeline/constants";
import {
  BYTES_READ_METRIC,
  READ_REQUESTS_METRIC,
} from "../../../packages/suite-base/src/players/IterablePlayer/Mcap/constants";
import {
  BLOCK_CACHE_METRICS,
  SOURCE_CACHE_METRICS,
} from "../../../packages/suite-base/src/players/IterablePlayer/constants";
import {
  HYDRATED_SOURCE_POOL_COUNTER_METRICS,
  HYDRATED_SOURCE_POOL_GAUGE_METRICS,
  HYDRATED_SOURCE_POOL_OVER_BUDGET_DURATION_METRIC,
  SOURCES_RELEVANT_METRIC,
  SOURCES_TOTAL_METRIC,
} from "../../../packages/suite-base/src/players/IterablePlayer/shared/constants";

export const RESULT_SCHEMA_VERSION = 1;

/**
 * File name suffix of the v1 results (`<scenario>-<platform>[-telemetry-off]-<ts>.benchmark-result.v1.json`),
 * written by `runner/artifacts.ts` and read by the viewer and the CI summary.
 */
export const RESULT_V1_SUFFIX = ".benchmark-result.v1.json";

/** File name prefix of the overhead A/B reports (`overhead-<platform>-<scenario>-<ts>.json`). */
export const OVERHEAD_PREFIX = "overhead-";

/** Prefix of the `HydratedSourcePool` telemetry series (scope "pipeline", label `poolId`). */
export { HYDRATED_SOURCE_POOL_METRIC_PREFIX as POOL_METRIC_PREFIX } from "../../../packages/suite-base/src/players/IterablePlayer/shared/constants";

/**
 * `HydratedSourcePool` metric names (label `poolId`), taken from the product so a rename there
 * cannot silently empty the pool summary: the gauges, the integer event counters and the derived
 * `overBudgetDurationMs` counter.
 */
export const POOL_METRICS = {
  ...HYDRATED_SOURCE_POOL_GAUGE_METRICS,
  ...HYDRATED_SOURCE_POOL_COUNTER_METRICS,
  overBudgetDurationMs: HYDRATED_SOURCE_POOL_OVER_BUDGET_DURATION_METRIC,
} as const;

/** Sink self metric: counter of records dropped, label `realm` (see `TELEMETRY_SELF_METRICS`). */
export const DROPPED_RECORDS_METRIC = "telemetry.droppedRecords";

/** Realm of the runner-produced host process samples. */
export const RUNNER_REALM = "runner";
/** Realm of the main-thread page sink (and of the `listenerDispatchDurationMs` samples). */
export const RENDERER_REALM = "renderer";

/** Host process sample metric names (scope "process", labels `{ processType, pid }`). */
export const PROCESS_METRICS = {
  workingSetBytes: "process.workingSetBytes",
  peakWorkingSetBytes: "process.peakWorkingSetBytes",
  privateBytes: "process.privateBytes",
  cpuPercent: "process.cpuPercent",
} as const;

/** Runner-observed failure types (see `runner/crashDetection.ts`). */
export const RUNNER_EVENT_TYPES = ["renderer.crash", "process.gone", "renderer.reload"] as const;

/** Events the relative phase times can be measured from (see `phasesOrigin`). */
export const PHASES_ORIGINS = ["datasource.open", "app.ready"] as const;

/**
 * Panel metric names (scope "panel", labels `{ panelId, panelType }`): the product's source of
 * truth, so a rename there cannot silently empty the summary. `renderDurationMs` is an observation
 * (published as `.count` / `.sum` / `.max`; see `observationMetrics`); the render metrics are
 * emitted by `PanelExtensionAdapter` panels only.
 */
export { PANEL_TELEMETRY_METRICS as PANEL_METRICS } from "../../../packages/suite-base/src/components/PanelExtensionAdapter/constants";

/**
 * Pipeline metric names (scope "pipeline"), taken from the product so a rename there cannot
 * silently empty the summary: `PIPELINE_TELEMETRY_METRICS` (MessagePipeline;
 * `listenerDispatchDurationMs` is an observation, published as `.count` / `.sum` / `.max`, see
 * `observationMetrics`) plus the player/source metrics of `BlockLoader`, `CachingIterableSource`,
 * `MultiIterableSource` and `RemoteFileReadable` (`packages/suite-base/src/players/IterablePlayer`).
 */
export const PIPELINE_METRICS = {
  ...PIPELINE_TELEMETRY_METRICS,
  blockCacheBytes: BLOCK_CACHE_METRICS.bytes,
  blockCacheMaxBytes: BLOCK_CACHE_METRICS.maxBytes,
  blockCacheEvictions: BLOCK_CACHE_METRICS.evictions,
  sourcesTotal: SOURCES_TOTAL_METRIC,
  sourcesRelevant: SOURCES_RELEVANT_METRIC,
  sourceCacheBytes: SOURCE_CACHE_METRICS.bytes,
  sourceCacheHits: SOURCE_CACHE_METRICS.hits,
  sourceCacheMisses: SOURCE_CACHE_METRICS.misses,
  remoteReadRequests: READ_REQUESTS_METRIC,
  remoteBytesRead: BYTES_READ_METRIC,
} as const;

/** `pipeline.memory.<key>` gauges (bytes, label `sourceId`) from `progress.memoryInfo`. */
export { MEMORY_METRIC_PREFIX as PIPELINE_MEMORY_METRIC_PREFIX } from "../../../packages/suite-base/src/players/IterablePlayer/constants";
