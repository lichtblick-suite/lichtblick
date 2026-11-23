// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too). Product metric names are
// imported by relative path so no `@lichtblick/suite-base` path alias is needed.

import type { GroupKpiDefs, KpiPolicy, ScorecardMetricKey } from "./kpis.types";
import type { HostCpuSourceV1, RunModeV1, WebBrowserV1 } from "./schemaV1.types";
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
import type { ScenarioGroup } from "../../src/scenarios/scenarioControl";

export const RESULT_SCHEMA_VERSION = 1;

/**
 * File name suffix of the v1 results (`<scenario>-<platform>[-telemetry-off]-<ts>.benchmark-result.v1.json`),
 * written by `runner/artifacts.ts` and read by the viewer and the CI summary.
 */
export const RESULT_V1_SUFFIX = ".benchmark-result.v1.json";

/** Values of `run.mode` (see `RunModeV1`). */
export const RUN_MODES: readonly RunModeV1[] = ["scenario"];

/** Values of `run.environment.webBrowser` (see `WebBrowserV1`). */
export const WEB_BROWSERS: readonly WebBrowserV1[] = ["chromium-headless-shell", "chromium"];

/** Values of `run.environment.hostCpuSource` (see `HostCpuSourceV1`). */
export const HOST_CPU_SOURCES: readonly HostCpuSourceV1[] = ["cdp", "app-metrics", "ps"];

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

/** Sink self metric: counter of records a sink dropped to its own ring overflow, label `realm`. */
export const DROPPED_RECORDS_METRIC = "telemetry.droppedRecords";
/**
 * Sink self metric: counter of the drops reported by batches a sink ingested, label `realm` (the
 * producing realm). The same drops as that realm's own `DROPPED_RECORDS_METRIC`, seen by the
 * receiver, so it is combined with it by max, not sum.
 */
export const INGESTED_DROPPED_RECORDS_METRIC = "telemetry.ingestedDroppedRecords";

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

/**
 * Warm-up excluded from steady-state trends (`summary.process.totalWorkingSetSlopeMiBPerMin`): at
 * least the first 20% of the measured window `[run.startMonotonicTs, run.windowEndMonotonicTs]`.
 * The steady window starts at the later of this fraction and the end of startup (panels ready /
 * first message, see `steadyStateFloorTs`), so app start, layout/panel mount and data source open
 * never dominate the slope; the fraction alone still applies to runs without those phases
 * (telemetry off).
 */
export const STEADY_STATE_WARMUP_FRACTION = 0.2;

/** Minimum steady-state host polls for a working-set slope (fewer: slope omitted). */
export const MIN_SLOPE_POINTS = 3;

/**
 * Minimum steady-state window for a working-set slope, ms (shorter: slope omitted). A few seconds
 * of polls cannot tell a leak from the tail of the startup ramp or a GC cycle.
 */
export const MIN_SLOPE_WINDOW_MS = 10_000;

/** Bytes per MiB (working-set slope unit). */
export const BYTES_PER_MIB = 1024 * 1024;

/** Milliseconds per minute / second (slope and CPU integral units). */
export const MS_PER_MINUTE = 60_000;
export const MS_PER_SECOND = 1000;

/**
 * Pipeline metric prefix -> product component that emits it, for `exercisedComponents`. Several
 * prefixes may map to one component. A sample whose metric starts with a prefix shows that the
 * component ran during the scenario.
 */
export const EXERCISED_COMPONENT_PREFIXES: readonly (readonly [
  prefix: string,
  component: string,
])[] = [
  ["pipeline.hydratedSourcePool.", "HydratedSourcePool"],
  ["pipeline.sources.", "MultiIterableSource"],
  ["pipeline.blockCache.", "BlockLoader"],
  ["pipeline.sourceCache.", "CachingIterableSource"],
  ["pipeline.remote.", "RemoteFileReadable"],
  ["pipeline.messages.", "MessagePipeline"],
  ["pipeline.subscribers.", "MessagePipeline"],
  ["pipeline.subscriptions.", "MessagePipeline"],
  ["pipeline.listenerDispatchDurationMs", "MessagePipeline"],
  ["pipeline.memory.", "IterablePlayer (memoryInfo)"],
];

/** `summary.kpis.smoothness.lowFps`: median FPS below this is flagged (informational, no target). */
export const LOW_FPS_WARNING = 10;

/** Panel types the group KPIs single out (`GROUP_KPIS`). */
export const PANEL_TYPE_3D = "3D";
export const PANEL_TYPE_PLOT = "Plot";

/**
 * Aggregation policy of the platform scorecard (`aggregateKpis`), per metric: `aggregate` combines
 * the runs, `worst` picks the run to link. Geometric mean for magnitudes that differ by orders
 * between scenarios (memory, CPU, startup, throughput: scale-invariant, equal weight to relative
 * change); worst case where one bad run is the finding (leak slope, smoothness).
 */
export const SCORECARD_POLICIES: Readonly<Record<ScorecardMetricKey, KpiPolicy>> = {
  peakTotalWorkingSetMiB: { aggregate: "geomean", worst: "max" },
  workingSetSlopeMiBPerMin: { aggregate: "max", worst: "max" },
  medianCpuPercent: { aggregate: "geomean", worst: "max" },
  cpuSecondsPerMiB: { aggregate: "geomean", worst: "max" },
  medianFps: { aggregate: "min", worst: "min" },
  fpsPercentOfCeiling: { aggregate: "min", worst: "min" },
  onTimeFramePercent: { aggregate: "min", worst: "min" },
  longTaskBlockedMsPerSec: { aggregate: "max", worst: "max" },
  panelsReadyMs: { aggregate: "geomean", worst: "max" },
  firstMessageMs: { aggregate: "geomean", worst: "max" },
  ingestMiBPerSec: { aggregate: "geomean", worst: "min" },
};

/** Scorecard render cost: highest p90 render ms per panel type over the runs. */
export const RENDER_COST_POLICY: KpiPolicy = { aggregate: "max", worst: "max" };

const WORST_MAX: KpiPolicy = { aggregate: "max", worst: "max" };
const GEOMEAN_MAX: KpiPolicy = { aggregate: "geomean", worst: "max" };
const GEOMEAN_MIN: KpiPolicy = { aggregate: "geomean", worst: "min" };

/**
 * Per scenario group (`groupKpis`): the primary KPI the group is judged by, then secondary ones.
 * Plot is a built-in React panel without render telemetry: the time-series primary falls back to
 * the listener dispatch p90 when no run has a Plot p90 render.
 */
export const GROUP_KPIS: Readonly<Record<ScenarioGroup, GroupKpiDefs>> = {
  "3d-rendering": {
    primary: {
      key: "onTimeFramePercent",
      label: "On-time frames",
      unit: "%",
      digits: 1,
      policy: { aggregate: "min", worst: "min" },
    },
    secondary: [
      { key: "p90Render3dMs", label: "3D p90 render", unit: "ms", digits: 1, policy: WORST_MAX },
      {
        key: "peakTotalWorkingSetMiB",
        label: "Peak memory",
        unit: "MiB",
        digits: 0,
        policy: GEOMEAN_MAX,
      },
    ],
  },
  "time-series": {
    primary: {
      key: "p90RenderPlotMs",
      label: "Plot p90 render",
      unit: "ms",
      digits: 1,
      policy: WORST_MAX,
      fallback: {
        key: "listenerDispatchP90Ms",
        label: "Listener dispatch p90",
        unit: "ms",
        digits: 2,
      },
    },
    secondary: [
      { key: "messagesPerSec", label: "Messages", unit: "msg/s", digits: 0, policy: GEOMEAN_MIN },
      { key: "medianCpuPercent", label: "CPU", unit: "%", digits: 0, policy: GEOMEAN_MAX },
    ],
  },
  preloading: {
    primary: {
      key: "preloadDurationMs",
      label: "Preload duration",
      unit: "ms",
      digits: 0,
      policy: GEOMEAN_MAX,
    },
    secondary: [
      {
        key: "blockCachePeakMiB",
        label: "Block cache peak",
        unit: "MiB",
        digits: 1,
        policy: WORST_MAX,
      },
      {
        key: "workingSetSlopeMiBPerMin",
        label: "Memory slope",
        unit: "MiB/min",
        digits: 1,
        policy: WORST_MAX,
      },
    ],
  },
  "real-pipeline-ingest": {
    primary: {
      key: "cpuSecondsPerMiB",
      label: "CPU s / MiB",
      unit: "s/MiB",
      digits: 3,
      policy: GEOMEAN_MAX,
    },
    secondary: [
      { key: "ingestMiBPerSec", label: "Ingest", unit: "MiB/s", digits: 2, policy: GEOMEAN_MIN },
      { key: "poolEvictions", label: "Pool evictions", unit: "", digits: 0, policy: WORST_MAX },
      {
        key: "poolRehydrations",
        label: "Pool rehydrations",
        unit: "",
        digits: 0,
        policy: WORST_MAX,
      },
      {
        key: "poolInvariantViolations",
        label: "Pool invariant violations",
        unit: "",
        digits: 0,
        policy: { aggregate: "sum", worst: "max" },
      },
    ],
  },
};
