// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  BufferedTelemetrySink,
  TelemetryBatch,
  TelemetryEventName,
  TelemetryLabels,
  TelemetryPhase,
  TelemetryScope,
  TelemetryUnit,
} from "@lichtblick/suite-base/util/telemetry";

import type { TelemetryToggleRequest } from "./types";

/**
 * Renderer sink of the benchmark page with a reversible recording gate (`setActive`), used by the
 * in-process overhead A/B (`window.lichtblickTelemetry.setTelemetryActive`).
 *
 * Swapping the realm sink (`setTelemetrySink(undefined)`) is not enough to stop recording: a few
 * producers keep the sink they saw (`HydratedSourcePool` caches it at construction, the Plot range
 * iterators of `useSubscribeMessageRange` for the iterator lifetime, an in-flight UA-memory call
 * until it resolves). While inactive every recording method and the periodic publish return at
 * once, so those cached references cost one call + one branch, like the no-op sink.
 *
 * `drain()` is not gated: records buffered before the switch stay drainable. `isEnabled()` is false
 * while inactive, so call sites that check it skip building labels and values.
 */
export class ToggleableTelemetrySink extends BufferedTelemetrySink {
  #active = true;

  /** Gates recording and publishing. Idempotent. */
  public setActive({ active }: TelemetryToggleRequest): void {
    this.#active = active;
  }

  public isActive(): boolean {
    return this.#active;
  }

  public override isEnabled(): boolean {
    return this.#active && super.isEnabled();
  }

  public override publishNow(): void {
    if (this.#active) {
      super.publishNow();
    }
  }

  public override gauge(
    metric: string,
    value: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void {
    if (this.#active) {
      super.gauge(metric, value, unit, scope, labels);
    }
  }

  public override counter(
    metric: string,
    increment: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void {
    if (this.#active) {
      super.counter(metric, increment, unit, scope, labels);
    }
  }

  public override observe(
    metric: string,
    value: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void {
    if (this.#active) {
      super.observe(metric, value, unit, scope, labels);
    }
  }

  public override event(
    name: TelemetryEventName,
    phase: TelemetryPhase,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void {
    if (this.#active) {
      super.event(name, phase, scope, labels);
    }
  }

  public override ingest(batch: TelemetryBatch): void {
    if (this.#active) {
      super.ingest(batch);
    }
  }
}
