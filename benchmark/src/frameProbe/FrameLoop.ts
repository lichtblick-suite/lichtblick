// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FrameLoopEnv } from "./FrameLoop.types";

/**
 * A `requestAnimationFrame` loop calling `onFrame(timestamp)` on every frame (one bound closure, no
 * allocation per frame). Benchmark harness: a running loop makes the browser produce a frame every
 * vsync even when nothing changes (style, paint, composite, GPU process), which costs CPU in a
 * mostly static scenario. The `FrameCollector` measures fps with it. Never part of the product.
 * Kept outside `benchmark/src/telemetry/`: the loop is harness (only the `onFrame` recording is
 * telemetry).
 *
 * The next frame is requested before `onFrame` runs, so a throwing callback does not end the loop.
 */
export class FrameLoop {
  readonly #env: FrameLoopEnv;
  readonly #onFrame: (timestamp: number) => void;
  #running = false;
  #handle = 0;

  readonly #tick = (timestamp: number): void => {
    if (!this.#running) {
      return;
    }
    this.#handle = this.#env.requestAnimationFrame!(this.#tick);
    this.#onFrame(timestamp);
  };

  public constructor(env: FrameLoopEnv, onFrame: (timestamp: number) => void) {
    this.#env = env;
    this.#onFrame = onFrame;
  }

  /** False without `requestAnimationFrame` (e.g. a worker or a test env): `start()` is a no-op. */
  public isSupported(): boolean {
    return this.#env.requestAnimationFrame != undefined;
  }

  public isRunning(): boolean {
    return this.#running;
  }

  /** Requests the first frame. Idempotent; no-op without `requestAnimationFrame`. */
  public start(): void {
    if (this.#running || !this.isSupported()) {
      return;
    }
    this.#running = true;
    this.#handle = this.#env.requestAnimationFrame!(this.#tick);
  }

  /** Cancels the pending frame; no callbacks until `start()`. Idempotent. */
  public stop(): void {
    if (!this.#running) {
      return;
    }
    this.#running = false;
    this.#env.cancelAnimationFrame?.(this.#handle);
  }
}
