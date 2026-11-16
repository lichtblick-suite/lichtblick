// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BufferedTelemetrySink } from "@lichtblick/suite-base/util/telemetry";

import {
  EMIT_COST_COUNTER_METRIC,
  EMIT_COST_DEFAULT_ITERATIONS,
  EMIT_COST_GAUGE_METRIC,
  EMIT_COST_LABELS,
  EMIT_COST_MAX_ITERATIONS,
  EMIT_COST_WARMUP_ITERATIONS,
  NS_PER_MS,
} from "./constants";
import { EmitCostResult, MeasureEmitCostOptions } from "./types";

export const ZERO_EMIT_COST: EmitCostResult = Object.freeze({
  gaugeNs: 0,
  counterNs: 0,
  eventNs: 0,
});

/** `iterations` as a positive integer <= `EMIT_COST_MAX_ITERATIONS`; else the default. */
export function resolveEmitCostIterations(iterations: number | undefined): number {
  if (iterations == undefined || !Number.isFinite(iterations) || iterations < 1) {
    return EMIT_COST_DEFAULT_ITERATIONS;
  }
  return Math.min(Math.floor(iterations), EMIT_COST_MAX_ITERATIONS);
}

/** Runs `emit` untimed for the warm-up, then `iterations` times; returns mean ns per call. */
function timeCalls(now: () => number, iterations: number, emit: (i: number) => void): number {
  for (let i = 0; i < EMIT_COST_WARMUP_ITERATIONS; i++) {
    emit(i);
  }
  const startMs = now();
  for (let i = 0; i < iterations; i++) {
    emit(i);
  }
  const elapsedMs = now() - startMs;
  return elapsedMs > 0 ? (elapsedMs * NS_PER_MS) / iterations : 0;
}

/**
 * Micro-benchmark of the sink's recording primitives in this page: `gauge`, `counter` and `event`
 * with a realistic metric name and `{ sourceId }` labels, each on its own throwaway
 * `BufferedTelemetrySink` built from `sinkOptions` (never started, never installed, dropped
 * afterwards), so the live sink and its records are untouched.
 *
 * After the warm-up, the series exists and the measured loops hit the steady-state update path
 * (gauges/counters: series-key build + map lookup; events: record allocation + ring push, which
 * overwrites the oldest record once the ring is full). The per-call figure includes one closure
 * call of the harness (~1 ns once optimized). Resolution is bounded by the clock (5-100 us).
 */
export function measureEmitCost({
  sinkOptions,
  now,
  iterations,
}: MeasureEmitCostOptions): EmitCostResult {
  const count = resolveEmitCostIterations(iterations);
  // Never forward the throwaway events to an observer (e.g. the live renderer collectors).
  const { onEvent: _onEvent, ...throwawayOptions } = sinkOptions;

  const gaugeSink = new BufferedTelemetrySink(throwawayOptions);
  const gaugeNs = timeCalls(now, count, (i) => {
    gaugeSink.gauge(EMIT_COST_GAUGE_METRIC, i, "bytes", "pipeline", EMIT_COST_LABELS);
  });

  const counterSink = new BufferedTelemetrySink(throwawayOptions);
  const counterNs = timeCalls(now, count, () => {
    counterSink.counter(EMIT_COST_COUNTER_METRIC, 1, "bytes", "pipeline", EMIT_COST_LABELS);
  });

  const eventSink = new BufferedTelemetrySink(throwawayOptions);
  const eventNs = timeCalls(now, count, () => {
    eventSink.event("datasource.firstMessage", "instant", "pipeline", EMIT_COST_LABELS);
  });

  return { gaugeNs, counterNs, eventNs };
}
