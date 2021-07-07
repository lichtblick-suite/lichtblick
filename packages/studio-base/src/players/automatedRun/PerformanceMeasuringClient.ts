// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import round from "lodash/round";
import sortBy from "lodash/sortBy";
import sum from "lodash/sum";

import sendNotification from "@foxglove/studio-base/util/sendNotification";

export type PerformanceStats = {
  bagLengthMs: number;
  speed: number;
  msPerFrame: number;
  frameRenderCount: number;

  // The "benchmark playback score" is the speed adjusted ratio of the bag length to the playback time.
  // It is not perfectly analagous to the playback ratio in production, which is capped at 1. In benchmarking we have a
  // fixed data frame size and we render as fast as possible, so this number can be greater than 1 and correlates with
  // but is not identical to what playback ratio would be when playing in production.
  // Higher is better for this metric.
  benchmarkPlaybackScore: number;
  playbackTimeMs: number;
  // Players may not mark their preload times.
  preloadTimeMs?: number;
  averageRenderMs: number;
  averageFrameTimeMs: number;
  frameTimePercentiles: { percentile: number; frameTimeMs: number }[];
};

const PERFORMANCE_MEASURING_MS_FRAMERATE_PARAM = "performance-measuring-framerate";
const PERFORMANCE_MEASURING_SPEED_PARAM = "performance-measuring-speed";

const params = new URLSearchParams(location.search);
const msPerFrame = params.has(PERFORMANCE_MEASURING_MS_FRAMERATE_PARAM)
  ? 1000 / parseFloat(params.get(PERFORMANCE_MEASURING_MS_FRAMERATE_PARAM) ?? "")
  : 1000 / 30;
const speed = params.has(PERFORMANCE_MEASURING_SPEED_PARAM)
  ? parseFloat(params.get(PERFORMANCE_MEASURING_SPEED_PARAM) ?? "")
  : 1;
if (isNaN(speed)) {
  throw new Error(`Invalid param ${PERFORMANCE_MEASURING_SPEED_PARAM}`);
}
if (isNaN(msPerFrame)) {
  throw new Error(`Invalid param ${PERFORMANCE_MEASURING_MS_FRAMERATE_PARAM}`);
}

// Define average([]) as 0.
const average = (numbers: number[]) => sum(numbers) / (numbers.length === 0 ? 1 : numbers.length);

// Marks are expensive: only enable marking performance when we can plausibly see and use the markings, IE in local
// development builds when we aren't doing benchmarking.
const enablePerformanceMarks = process.env.NODE_ENV === "development";

class PerformanceMeasuringClient {
  shouldLoadDataBeforePlaying = true;
  enablePerformanceMarks = enablePerformanceMarks;

  speed = speed;
  msPerFrame = msPerFrame;
  bagLengthMs?: number;

  startTime?: number;
  startedMeasuringPerformance = false;
  frameRenderStart?: number;
  frameRenderTimes: number[] = [];
  preloadStart?: number;
  preloadTimeMs?: number;
  totalFrameMs?: number;
  totalFrameTimes: number[] = [];

  start({ bagLengthMs }: { bagLengthMs: number }): void {
    if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
      sendNotification(
        "In performance measuring mode, but NODE_ENV is not production!",
        "Use `yarn performance-start` instead of `yarn start`.",
        "user",
        "error",
      );
      return;
    }

    this.bagLengthMs = bagLengthMs;
    this.startTime = performance.now();
    this.startedMeasuringPerformance = true;
  }

  markFrameRenderStart(): void {
    this.frameRenderStart = performance.now();
    if (this.enablePerformanceMarks) {
      performance.mark("FRAME_RENDER_START");
    }
  }

  markFrameRenderEnd(): number {
    const frameRenderStart = this.frameRenderStart;
    if (frameRenderStart == undefined) {
      throw new Error("Called markFrameRenderEnd without calling markFrameRenderStart");
    }
    if (this.enablePerformanceMarks) {
      performance.mark("FRAME_RENDER_END");
      performance.measure("FRAME_RENDER", "FRAME_RENDER_START", "FRAME_RENDER_END");
    }
    const frameTimeMs = performance.now() - frameRenderStart;
    this.frameRenderTimes.push(round(frameTimeMs));
    this.frameRenderStart = undefined;
    return frameTimeMs;
  }

  markPreloadStart(): void {
    this.preloadStart = performance.now();
    if (this.enablePerformanceMarks) {
      performance.mark("PRELOAD_START");
    }
  }

  markPreloadEnd(): number {
    const { preloadStart } = this;
    if (preloadStart == undefined) {
      throw new Error("Called markPreloadEnd without calling markPreloadStart");
    }
    if (this.enablePerformanceMarks) {
      performance.mark("PRELOAD_END");
      performance.measure("PRELOAD", "PRELOAD_START", "PRELOAD_END");
    }
    const preloadTimeMs = performance.now() - preloadStart;
    this.preloadTimeMs = round(performance.now() - preloadStart);
    this.preloadStart = undefined;
    return preloadTimeMs;
  }

  markTotalFrameStart(): void {
    this.totalFrameMs = performance.now();
  }

  markTotalFrameEnd(): void {
    const totalFrameMs = this.totalFrameMs;
    if (totalFrameMs == undefined) {
      throw new Error("Called markTotalFrameEnd without calling markTotalFrameStart");
    }
    this.totalFrameTimes.push(round(performance.now() - totalFrameMs));
    this.totalFrameMs = undefined;
  }

  async onError(e: Error): Promise<void> {
    const event = new CustomEvent("playbackError", { detail: e.toString() });
    window.dispatchEvent(event);
    // Never bother to resolve this promise since we should stop perf playback whenever any error occurs.
    return await new Promise<void>(() => {
      // no-op
    });
  }

  async onFrameFinished(): Promise<void> {
    // no-op
  }

  async finish(): Promise<void> {
    const startTime = this.startTime;
    const bagLengthMs = this.bagLengthMs;
    const preloadTimeMs = this.preloadTimeMs;

    if (startTime == undefined || bagLengthMs == undefined) {
      throw new Error("Cannot call finish() without calling start()");
    }

    const playbackTimeMs = round(performance.now() - startTime);
    const benchmarkPlaybackScore = round(bagLengthMs / (playbackTimeMs * this.speed), 3);
    const averageRenderMs = round(average(this.frameRenderTimes), 2);
    const averageFrameTimeMs = round(average(this.totalFrameTimes));

    const sortedFrameLengths = sortBy(this.totalFrameTimes);
    const getPercentile = (percentile: number): number => {
      if (sortedFrameLengths.length === 0) {
        return 0;
      }
      // The 100th percentile (i.e. max) frame time is at index (length - 1).
      const index = Math.round((percentile / 100) * (sortedFrameLengths.length - 1));
      return sortedFrameLengths[index] ?? 0;
    };
    const frameTimePercentiles = [50, 90, 95, 99, 100].map((percentile) => ({
      percentile,
      frameTimeMs: getPercentile(percentile),
    }));

    const frameRenderCount = this.frameRenderTimes.length;
    const detail: PerformanceStats = {
      bagLengthMs,
      speed: this.speed,
      msPerFrame: this.msPerFrame,
      frameRenderCount,
      benchmarkPlaybackScore,
      playbackTimeMs,
      averageRenderMs,
      averageFrameTimeMs,
      frameTimePercentiles,
      preloadTimeMs,
    };

    const event = new CustomEvent("playbackFinished", { detail });
    window.dispatchEvent(event);
  }
}

export default PerformanceMeasuringClient;
