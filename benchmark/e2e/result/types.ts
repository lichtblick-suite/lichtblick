// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too).

/** Measured window of the run, in absolute page `monotonicTs`. */
export type PipelineWindow = { startTs: number; endTs: number };

/** Aggregate of an `observe()` series over the whole run (all realms / label sets in the input). */
export type ObservationSummary = {
  /** Final `${metric}.count` total. */
  count: number;
  /** Final `${metric}.sum` total (in the metric's unit). */
  sum: number;
  /** `sum / count`; undefined without observations. */
  mean?: number;
  /** Maximum of the per-window `${metric}.max` gauges. */
  max?: number;
  /** p90 of the per-window `${metric}.max` gauges (spike indicator: "how bad are bad seconds"). */
  p90WindowMax?: number;
};
