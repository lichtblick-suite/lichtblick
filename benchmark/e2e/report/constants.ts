// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too, through
// `summaryMarkdown.ts`).

import type { HostCpuSourceV1 } from "../result/schemaV1.types";

export const KIB = 1024;
export const MIB = 1024 * 1024;

/** Placeholder of a missing value in the markdown summary. */
export const NONE = "—";

/** Shown for fields that results written by older runners lack (lenient loading). */
export const NOT_RECORDED = "not recorded";
export const SCENARIO_NOT_RECORDED = "scenario not recorded";

/** Environment-table text of `run.environment.hostCpuSource` (see `HostCpuSourceV1`). */
export const HOST_CPU_SOURCE_LABELS: Record<HostCpuSourceV1, string> = {
  cdp: "CDP cpuTime (per poll)",
  "app-metrics": "Electron app metrics (per poll)",
  ps: "ps fallback (CPU not measured)",
};

export const REGENERATE_COMMAND = "yarn test:e2e:benchmark:viewer";

/** Upper bound of points per chart dataset (longer series are downsampled). */
export const MAX_POINTS_PER_DATASET = 600;

/** A run is stale when it finished more than this before the newest run of the report. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Screenshot checkpoints in display order. */
export const CHECKPOINT_ORDER = ["loaded", "mid", "end"];

/** Folder names below the artifacts folder read and written by the viewer CLI. */
export const SCREENSHOTS_DIR_NAME = "screenshots";
export const REPORT_DIR_NAME = "report";

export const KPI_HEADERS = [
  "Scenario",
  "Platform",
  "Run",
  "Peak memory (MiB)",
  "Median CPU %",
  "Peak JS heap (MiB)",
  "First message (ms)",
  "First useful frame (ms)",
  "Layout applied (ms)",
  "Panels ready (ms)",
  "Median FPS / ceiling",
  "GL backend",
  "Pipeline msg/s",
  "Pipeline MiB/s",
  "Source cache hit ratio",
  "Pool invariant",
  "Runner events",
];

/** Coverage matrix column groups, in display order (`htmlReportExercises.ts`). */
export const COVERAGE_KINDS = [
  { kind: "panel", label: "Panel types" },
  { kind: "player", label: "Players" },
  { kind: "component", label: "Pipeline components" },
] as const;

/** Coverage matrix cell symbols and their legend. */
export const COVERAGE_SYMBOLS = {
  observed: { symbol: "✓", title: "observed in telemetry" },
  declared: { symbol: "○", title: "declared by the scenario only (no telemetry)" },
} as const;

/** Prefixes of the report filter tokens (`data-tags`, `data-filter`). */
export const FILTER_GROUP_PREFIX = "group:";
export const FILTER_TAG_PREFIX = "tag:";

/** Electron first: platforms are always shown (and aggregated) separately. */
export const PLATFORM_ORDER = ["electron", "web"] as const;

/**
 * CPU card note: both platforms report a per-core sum over their processes, but the process sets
 * differ (web adds headless browser/SwiftShader GPU work), so CPU is compared within a platform.
 */
export const CPU_SCALE_NOTE =
  "sum over processes, 100 % = one core; process sets differ, compare within a platform";

/**
 * Short GL backend shown next to FPS (first keyword found in `run.environment.glRenderer`; the full
 * string is in the cell title). SwiftShader = software rendering.
 */
export const GL_BACKEND_KEYWORDS = ["SwiftShader", "Metal", "Vulkan", "D3D11", "D3D9", "OpenGL"];
