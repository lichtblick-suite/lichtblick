// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ITelemetry, TelemetryLabels } from "@lichtblick/suite-base/util/telemetry";

import { LATE_FRAME_THRESHOLD_MS, RENDERER_METRICS } from "./constants";
import { FrameCollectorEnv } from "./types";

/**
 * Runs a `requestAnimationFrame` loop that only updates numeric accumulators (no allocation per
 * frame; the callback is a single bound closure). `publish()` — called from the 1 Hz collector tick,
 * never from inside the RAF callback — turns them into:
 * - gauge `renderer.fps`: frames counted / elapsed time of the window
 * - counter `renderer.lateFrames`: frames whose delta to the previous frame > `LATE_FRAME_THRESHOLD_MS`
 *
 * It also emits `frame.firstUseful` (instant, scope "renderer") on the first animation frame after
 * `markFirstMessage()` — i.e. the first frame the browser produced after the player delivered its
 * first message. This is an APPROXIMATION: it does not prove any panel rendered that message. It
 * will be replaced by panel-ready markers once those exist (deferred).
 */
export class FrameCollector {
  readonly #telemetry: ITelemetry;
  readonly #env: FrameCollectorEnv;

  #running = false;
  #rafHandle = 0;
  #frameCount = 0;
  #lateFrameCount = 0;
  /** RAF timestamp of the previous frame; negative until the first frame of a run. */
  #lastFrameTs = -1;
  #windowStartMs = 0;

  #firstUsefulPending = false;
  #firstUsefulEmitted = false;
  #firstUsefulLabels: TelemetryLabels | undefined;

  readonly #onFrame = (timestamp: number): void => {
    if (!this.#running) {
      return;
    }
    if (this.#lastFrameTs >= 0 && timestamp - this.#lastFrameTs > LATE_FRAME_THRESHOLD_MS) {
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

    this.#rafHandle = this.#env.requestAnimationFrame!(this.#onFrame);
  };

  public constructor(telemetry: ITelemetry, env: FrameCollectorEnv) {
    this.#telemetry = telemetry;
    this.#env = env;
  }

  public isSupported(): boolean {
    return this.#env.requestAnimationFrame != undefined;
  }

  /** Starts the RAF loop and the first fps window. Idempotent; no-op without RAF. */
  public start(): void {
    if (this.#running || !this.isSupported()) {
      return;
    }
    this.#running = true;
    this.#windowStartMs = this.#env.now();
    this.#rafHandle = this.#env.requestAnimationFrame!(this.#onFrame);
  }

  /** Publishes fps / late frames for the window since the previous call and starts a new window. */
  public publish(): void {
    if (!this.#running) {
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
    if (this.#firstUsefulEmitted || this.#firstUsefulPending || !this.#running) {
      return;
    }
    this.#firstUsefulPending = true;
    this.#firstUsefulLabels = labels;
  }

  public dispose(): void {
    if (!this.#running) {
      return;
    }
    this.#running = false;
    this.#env.cancelAnimationFrame?.(this.#rafHandle);
    this.#firstUsefulPending = false;
    this.#firstUsefulLabels = undefined;
  }
}
