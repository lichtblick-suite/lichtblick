// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ITelemetry, TelemetryUnit } from "@lichtblick/suite-base/util/telemetry";

import { TELEMETRY_SELF_COST_METRICS, TELEMETRY_SELF_COST_UNITS } from "../constants";
import type { SelfCostMetricKey } from "../types";

const SELF_COST_KEYS = Object.keys(TELEMETRY_SELF_COST_METRICS) as readonly SelfCostMetricKey[];

/**
 * One self-cost counter. Measured call sites resolve it once (constructor) and then only update a
 * plain numeric field: no allocation, no keyed lookup, no telemetry call per measured call.
 */
export class SelfCostCounter {
  readonly #metric: string;
  readonly #unit: TelemetryUnit;
  readonly #now: () => number;
  #pending = 0;

  public constructor(metric: string, unit: TelemetryUnit, now: () => number) {
    this.#metric = metric;
    this.#unit = unit;
    this.#now = now;
  }

  /** The self-cost clock (ms); take the start of a measured section with it. */
  public now(): number {
    return this.#now();
  }

  /** Adds `amount`; ignored unless > 0 (counters reject negative increments; NaN fails too). */
  public add(amount: number): void {
    if (amount > 0) {
      this.#pending += amount;
    }
  }

  /** Adds the time elapsed since `startMs` (a value returned by `now()`). */
  public addSince(startMs: number): void {
    this.add(this.#now() - startMs);
  }

  /** Emits the accumulated amount as one counter increment and resets it. */
  public publish(telemetry: ITelemetry): void {
    telemetry.counter(this.#metric, this.#pending, this.#unit, "renderer");
    this.#pending = 0;
  }
}

/**
 * Accumulates the benchmark telemetry's own cost (`TELEMETRY_SELF_COST_METRICS`). Only created when
 * telemetry is enabled. `publish()` is called from the renderer collector tick (1 Hz) and emits one
 * `counter()` per metric (also when the window's amount is 0, so every series exists; the sink
 * skips unchanged counters after their first publish).
 *
 * Publishing itself is not timed (8 counter updates per second, constant cost), which also rules
 * out any recursive self-measurement.
 */
export class SelfCostMeter {
  readonly #now: () => number;
  readonly #byKey: Readonly<Record<SelfCostMetricKey, SelfCostCounter>>;
  readonly #all: readonly SelfCostCounter[];

  public constructor(now: () => number) {
    this.#now = now;
    const byKey = {} as Record<SelfCostMetricKey, SelfCostCounter>;
    const all: SelfCostCounter[] = [];
    for (const key of SELF_COST_KEYS) {
      const counter = new SelfCostCounter(
        TELEMETRY_SELF_COST_METRICS[key],
        TELEMETRY_SELF_COST_UNITS[key],
        now,
      );
      byKey[key] = counter;
      all.push(counter);
    }
    this.#byKey = byKey;
    this.#all = all;
  }

  /** The self-cost clock (ms). */
  public now(): number {
    return this.#now();
  }

  /** The counter of `key`; resolve once, outside hot paths. */
  public counter(key: SelfCostMetricKey): SelfCostCounter {
    return this.#byKey[key];
  }

  /**
   * Wraps `handler` so the time spent inside it is added to `key`. Allocates one closure; wrap once
   * (e.g. when a timer is scheduled), not per call.
   */
  public timed(key: SelfCostMetricKey, handler: () => void): () => void {
    const counter = this.#byKey[key];
    return () => {
      const startMs = counter.now();
      try {
        handler();
      } finally {
        counter.addSince(startMs);
      }
    };
  }

  /** One `counter()` call per self-cost metric (scope "renderer", no labels), then resets. */
  public publish(telemetry: ITelemetry): void {
    for (const counter of this.#all) {
      counter.publish(telemetry);
    }
  }
}
