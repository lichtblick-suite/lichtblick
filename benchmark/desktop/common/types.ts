// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { ProcessMetric } from "electron";

/** IPC channel used by the benchmark desktop preload bridge to request process memory metrics. */
export const GET_MEMORY_METRICS_CHANNEL = "lichtblick-benchmark:get-memory-metrics";

/** Mirrors the shape returned by Electron's `app.getAppMetrics()`, unmodified. */
export type BenchmarkMemoryMetric = ProcessMetric;

export interface LichtblickBenchmarkBridge {
  getMemoryMetrics: () => Promise<BenchmarkMemoryMetric[]>;
}
