// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too, through
// `summaryMarkdown.ts`).

export const KIB = 1024;
export const MIB = 1024 * 1024;

/** Placeholder of a missing value in the markdown summary. */
export const NONE = "—";

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
  "Median FPS",
  "Pipeline msg/s",
  "Pipeline MiB/s",
  "Source cache hit ratio",
  "Pool invariant",
  "Runner events",
  "Overhead CPU (≤ 2 %)",
  "Overhead memory (≤ 20 MiB)",
];
