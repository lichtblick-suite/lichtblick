// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { MetricStats } from "../result/stats.types";
import type { OverheadVerdictSource } from "../runner/overhead.types";

/** Statistics behind a report's CPU verdict (toggle or relaunch A/B), see `cpuVerdictStats`. */
export type CpuVerdictStats = {
  source: Exclude<OverheadVerdictSource, "notMeasured">;
  /** Included statistical units: relaunch pairs or toggle ABBA quartets (`source`). */
  n: number;
  /** Excluded pairs / quartets. */
  excluded: number;
  /** Normalized schema-1 report (relaunch, one pair). */
  legacy?: true;
  cpuRelative: MetricStats;
  cpuPctPoints: MetricStats;
};
