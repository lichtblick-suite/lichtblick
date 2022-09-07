// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { std } from "mathjs";

import Log from "@foxglove/log";

const log = Log.getLogger(__filename);

type Sample = {
  stamp: number;
  value: number;
};

type RecordFrameTimesFn = (frameTimes: Sample[]) => void;

class BenchmarkStats {
  private static instance: BenchmarkStats | undefined;

  private frameTimesMs: Sample[] = [];

  private constructor() {}

  public recordFrameTime(durationMs: number): void {
    this.frameTimesMs.push({
      stamp: Date.now() / 1_000,
      value: durationMs,
    });

    if (this.frameTimesMs.length >= 100) {
      const values = this.frameTimesMs.map((sample) => sample.value);
      const totalFrameMs = values.reduce((a, b) => a + b, 0);
      const avgFrameMs = totalFrameMs / values.length;

      const sortedFrameMs = values.sort();
      const medianFrameMs = sortedFrameMs[Math.floor(sortedFrameMs.length * 0.5)]!;
      const p90FrameMs = sortedFrameMs[Math.floor(sortedFrameMs.length * 0.9)]!;
      const stddev = std(values);

      log.info(
        `Frame time (filtered) average: ${avgFrameMs}, median: ${medianFrameMs}, P90: ${p90FrameMs}, stddev: ${stddev}`,
      );

      const record = (window as { recordFrameTimes?: RecordFrameTimesFn }).recordFrameTimes;
      record?.(this.frameTimesMs);

      this.frameTimesMs.length = 0;
    }
  }

  /** Return an instance of BenchmarkStats */
  public static Instance(): BenchmarkStats {
    BenchmarkStats.instance = BenchmarkStats.instance ?? new BenchmarkStats();
    return BenchmarkStats.instance;
  }
}

export { BenchmarkStats };
