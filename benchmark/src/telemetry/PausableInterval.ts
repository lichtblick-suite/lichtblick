// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

type SetIntervalFn = (handler: () => void, intervalMs: number) => unknown;
type ClearIntervalFn = (handle: unknown) => void;

/**
 * One repeating timer that can be paused and resumed from outside its owner. Passed as the
 * `setInterval`/`clearInterval` options of the renderer sink, whose `start()` schedules its publish
 * timer once and which has no pause of its own: `pause()` really clears the underlying timer (no
 * wake-ups while telemetry is toggled off), `resume()` schedules it again with a fresh phase.
 *
 * Holds a single interval: a second `set` replaces the first.
 */
export class PausableInterval {
  readonly #setInterval: SetIntervalFn;
  readonly #clearInterval: ClearIntervalFn;
  #handler: (() => void) | undefined;
  #intervalMs = 0;
  #handle: unknown;
  #scheduled = false;
  #paused = false;

  public constructor(setInterval: SetIntervalFn, clearInterval: ClearIntervalFn) {
    this.#setInterval = setInterval;
    this.#clearInterval = clearInterval;
  }

  /** `setInterval` replacement; the returned token is only meaningful to `clear`. */
  public readonly set = (handler: () => void, intervalMs: number): unknown => {
    this.#cancel();
    this.#handler = handler;
    this.#intervalMs = intervalMs;
    if (!this.#paused) {
      this.#schedule();
    }
    return this;
  };

  /** `clearInterval` replacement: stops and forgets the interval. */
  public readonly clear = (_token: unknown): void => {
    this.#cancel();
    this.#handler = undefined;
  };

  /** Stops the timer until `resume()`. Idempotent. */
  public pause(): void {
    this.#paused = true;
    this.#cancel();
  }

  /** Reschedules the timer (if one was set). Idempotent. */
  public resume(): void {
    if (!this.#paused) {
      return;
    }
    this.#paused = false;
    if (this.#handler != undefined) {
      this.#schedule();
    }
  }

  public isScheduled(): boolean {
    return this.#scheduled;
  }

  #schedule(): void {
    this.#handle = this.#setInterval(this.#handler!, this.#intervalMs);
    this.#scheduled = true;
  }

  #cancel(): void {
    if (this.#scheduled) {
      this.#clearInterval(this.#handle);
      this.#handle = undefined;
      this.#scheduled = false;
    }
  }
}
