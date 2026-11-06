// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node runtime imports.

import type { PersistedResultV1 } from "../result/schemaV1";
import type { OverheadReport } from "../runner/overhead.types";

/**
 * A parsed result (leniently validated: older local artifacts may lack `run.scenario` and the render
 * calibration, see `PersistedResultV1`) and the file it came from.
 */
export type LoadedResult = { fileName: string; result: PersistedResultV1 };

export type ParseOutcome<T> = { ok: true; value: T } | { ok: false; reason: string };

export type ScreenshotLink = { checkpoint: string; fileName: string };

export type Point = { x: number; y: number };

export type ChartDataset = {
  label: string;
  data: Point[];
  /** Secondary y axis (`y2`). */
  secondary?: boolean;
  /** Stacked area (memory per process type). */
  stacked?: boolean;
  /** Dashed reference line (limits, totals). */
  dashed?: boolean;
};

export type ChartSpec = {
  id: string;
  title: string;
  yLabel: string;
  y2Label?: string;
  stacked?: boolean;
  datasets: ChartDataset[];
};

export type PhaseMarker = { label: string; x: number; kind: "phase" | "failure" };

export type RunChartData = {
  /** x axis range (seconds from the phases origin). */
  xMin: number;
  xMax: number;
  /** What x = 0 is (`summary.phases.origin`, else the run start). */
  originLabel: string;
  markers: PhaseMarker[];
  charts: ChartSpec[];
};

export type HtmlReportInput = {
  /** ISO wall-clock time of generation. */
  generatedAtWall: string;
  /** Commit/branch at generation time (results do not record them). */
  git?: { commit?: string; branch?: string };
  /** Every valid result found (selection happens here, see `selectRuns`). */
  results: readonly LoadedResult[];
  /** Include every run instead of the latest per scenario × platform × telemetry mode. */
  all: boolean;
  /** Files skipped as invalid (shown in the header). */
  skipped: readonly { fileName: string; reason: string }[];
  overheads: readonly OverheadReport[];
  /** File names in the screenshots folder. */
  screenshotFiles: readonly string[];
  /** Screenshots folder, relative to the HTML file (e.g. `../screenshots/`). */
  screenshotsHref: string;
};

export type HtmlReportOptions = {
  /** Returns the Chart.js UMD bundle source (inlined once). */
  loadChartJs: () => string;
};

/** Unit of a displayed overhead delta: raw value ÷ `divisor`, `digits` decimals, `suffix`. */
export type DeltaUnit = { divisor: number; digits: number; suffix: string };
