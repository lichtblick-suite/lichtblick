// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { std } from "mathjs";

import Log from "@lichtblick/log";
import { monotonicNow } from "@lichtblick/suite-base/util/telemetry";

import type { BenchmarkStatsGlobal } from "./BenchmarkStats.types";
import { FLUSH_SAMPLE_COUNT, LISTENER_DISPATCH_DURATION_METRIC } from "./constants";
import type { ListenerDispatchDurationSample } from "./types";

const log = Log.getLogger(__filename);

class BenchmarkStats {
  static #instance: BenchmarkStats | undefined;

  #samples: ListenerDispatchDurationSample[] = [];

  private constructor() {}

  /**
   * Records how long it took to dispatch one player state to the message pipeline listener
   * (`await listener(playerState)`), in milliseconds.
   *
   * This is NOT a rendered-frame time: panels may render later (or not at all) and the browser may
   * paint independently of the listener resolving. Use the renderer telemetry (`renderer.fps`,
   * `renderer.lateFrames`) for frame pacing.
   */
  public recordListenerDispatchDuration(durationMs: number): void {
    this.#samples.push({
      stamp: Date.now() / 1_000,
      value: durationMs,
      monotonicTs: monotonicNow(),
    });

    if (this.#samples.length < FLUSH_SAMPLE_COUNT) {
      return;
    }

    const samples = this.#samples;
    // Hand the full batch to the runner and start a new buffer instead of truncating in place, so
    // a consumer that holds on to the array never sees it emptied underneath it.
    this.#samples = [];

    const values = samples.map((sample) => sample.value);
    const total = values.reduce((a, b) => a + b, 0);
    const average = total / values.length;

    const sorted = values.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length * 0.5)]!;
    const p90 = sorted[Math.floor(sorted.length * 0.9)]!;
    const stddev = std(values);

    log.info(
      `Listener dispatch duration (${LISTENER_DISPATCH_DURATION_METRIC}) average: ${String(average)}, median: ${String(median)}, P90: ${String(p90)}, stddev: ${String(stddev.values)}`,
    );

    const record = (globalThis as BenchmarkStatsGlobal).recordFrameTimes;
    record?.(samples);
  }

  /** Return an instance of BenchmarkStats */
  public static Instance(): BenchmarkStats {
    BenchmarkStats.#instance = BenchmarkStats.#instance ?? new BenchmarkStats();
    return BenchmarkStats.#instance;
  }
}

export { BenchmarkStats };
