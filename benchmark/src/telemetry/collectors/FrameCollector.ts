// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ITelemetry, TelemetryLabels } from "@lichtblick/suite-base/util/telemetry";

import { SelfCostCounter, SelfCostMeter } from "./SelfCostMeter";
import { LATE_FRAME_THRESHOLD_MS, RENDERER_METRICS } from "./constants";
import { FrameCollectorEnv } from "./types";
import { FrameLoop } from "../../frameProbe";

/**
 * Runs a `requestAnimationFrame` loop (`FrameLoop`) that only updates numeric accumulators (no
 * allocation per frame; the callback is a single bound closure). `publish()` — called from the 1 Hz collector tick,
 * never from inside the RAF callback — turns them into:
 * - gauge `renderer.fps`: frames counted / elapsed time of the window
 * - counter `renderer.frames`: frames counted
 * - counter `renderer.lateFrames`: frames whose delta to the previous frame > the late-frame
 *   threshold (`lateFrameThresholdMs`, default `LATE_FRAME_THRESHOLD_MS`)
 *
 * It also emits `frame.firstUseful` (instant, scope "renderer") on the first animation frame after
 * `markFirstMessage()` — i.e. the first frame the browser produced after the player delivered its
 * first message. This is an APPROXIMATION: it does not prove any panel rendered that message. It
 * will be replaced by panel-ready markers once those exist (deferred).
 *
 * The time spent inside the RAF callback is accumulated into `telemetry.self.timeMs.frames`
 * (two clock reads per frame, no allocation).
 *
 * `pause()` (telemetry toggled off) stops recording but keeps the frame loop running: the loop is
 * benchmark harness (it makes the browser render every vsync, see `FrameLoop`), not telemetry, so
 * the toggle A/B runs it in both arms and isolates the telemetry recording. Only `dispose()` stops
 * the loop.
 */
export class FrameCollector {
  readonly #telemetry: ITelemetry;
  readonly #env: FrameCollectorEnv;
  readonly #lateFrameThresholdMs: number;
  /** Time spent inside the RAF callback (`telemetry.self.timeMs.frames`). */
  readonly #selfTime: SelfCostCounter;

  readonly #loop: FrameLoop;
  /** Counting frames and publishing (between `start()` and `pause()` / `dispose()`). */
  #recording = false;
  #frameCount = 0;
  #lateFrameCount = 0;
  /** RAF timestamp of the previous frame; negative until the first frame of a run. */
  #lastFrameTs = -1;
  #windowStartMs = 0;

  #firstUsefulPending = false;
  #firstUsefulEmitted = false;
  #firstUsefulLabels: TelemetryLabels | undefined;

  readonly #onFrame = (timestamp: number): void => {
    if (!this.#recording) {
      return;
    }
    const selfStartMs = this.#selfTime.now();
    if (this.#lastFrameTs >= 0 && timestamp - this.#lastFrameTs > this.#lateFrameThresholdMs) {
      this.#lateFrameCount++;
    }
    this.#lastFrameTs = timestamp;
    this.#frameCount++;

    if (this.#firstUsefulPending) {
      this.#firstUsefulPending = false;
      this.#firstUsefulEmitted = true;
      this.#telemetry.event("frame.firstUseful", "instant", "renderer", this.#firstUsefulLabels);
      this.#firstUsefulLabels = undefined;
    }

    this.#selfTime.addSince(selfStartMs);
  };

  public constructor(
    telemetry: ITelemetry,
    env: FrameCollectorEnv,
    lateFrameThresholdMs: number = LATE_FRAME_THRESHOLD_MS,
    selfCost: SelfCostMeter = new SelfCostMeter(env.now),
  ) {
    this.#telemetry = telemetry;
    this.#env = env;
    this.#lateFrameThresholdMs = lateFrameThresholdMs;
    this.#selfTime = selfCost.counter("framesMs");
    this.#loop = new FrameLoop(env, this.#onFrame);
  }

  public isSupported(): boolean {
    return this.#loop.isSupported();
  }

  /** Whether the RAF loop runs (also while paused). */
  public isLoopRunning(): boolean {
    return this.#loop.isRunning();
  }

  /**
   * Starts recording with a new fps window, and the RAF loop unless it still runs from before a
   * `pause()` (also after `dispose()`). Idempotent; no-op without RAF.
   */
  public start(): void {
    if (this.#recording || !this.isSupported()) {
      return;
    }
    this.#recording = true;
    this.#frameCount = 0;
    this.#lateFrameCount = 0;
    this.#lastFrameTs = -1;
    this.#windowStartMs = this.#env.now();
    this.#loop.start();
  }

  /** Publishes fps / frames / late frames for the window since the previous call and starts a new window. */
  public publish(): void {
    if (!this.#recording) {
      return;
    }
    const now = this.#env.now();
    const elapsedMs = now - this.#windowStartMs;
    if (elapsedMs > 0) {
      this.#telemetry.gauge(
        RENDERER_METRICS.fps,
        (this.#frameCount * 1000) / elapsedMs,
        "fps",
        "renderer",
      );
    }
    this.#telemetry.counter(RENDERER_METRICS.frames, this.#frameCount, "count", "renderer");
    this.#telemetry.counter(RENDERER_METRICS.lateFrames, this.#lateFrameCount, "count", "renderer");
    this.#frameCount = 0;
    this.#lateFrameCount = 0;
    this.#windowStartMs = now;
  }

  /**
   * Arms `frame.firstUseful` for the next animation frame. Only the first call has an effect.
   * `labels` (e.g. `{ sourceId }` of the `datasource.firstMessage` event) are attached to it.
   */
  public markFirstMessage(labels?: TelemetryLabels): void {
    if (this.#firstUsefulEmitted || this.#firstUsefulPending || !this.#recording) {
      return;
    }
    this.#firstUsefulPending = true;
    this.#firstUsefulLabels = labels;
  }

  /**
   * Stops recording (no counting, no telemetry) while the RAF loop keeps running, so the page
   * renders the same frames as while recording; an armed `frame.firstUseful` stays armed. The gap is
   * not a late frame: the next `start()` begins a fresh window. Idempotent.
   */
  public pause(): void {
    if (!this.#recording) {
      return;
    }
    this.#recording = false;
    this.#lastFrameTs = -1;
  }

  /** Stops recording and the RAF loop (no frame callbacks until `start()`). */
  public dispose(): void {
    this.pause();
    this.#loop.stop();
    this.#firstUsefulPending = false;
    this.#firstUsefulLabels = undefined;
  }
}
