// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { getTelemetry } from "@lichtblick/suite-base/util/telemetry";

import { buildSteppingClock } from "./collectors/builders/RendererCollectorsEnvBuilder";
import {
  EMIT_COST_DEFAULT_ITERATIONS,
  EMIT_COST_MAX_ITERATIONS,
  RENDERER_REALM,
} from "./constants";
import { measureEmitCost, resolveEmitCostIterations } from "./measureEmitCost";

describe("resolveEmitCostIterations", () => {
  it.each([
    undefined,
    0,
    -3,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("should fall back to the default for %p", (iterations) => {
    // Given / When
    const resolved = resolveEmitCostIterations(iterations);

    // Then
    expect(resolved).toBe(EMIT_COST_DEFAULT_ITERATIONS);
  });

  it("should floor fractional counts and cap large ones", () => {
    // Given / When
    const floored = resolveEmitCostIterations(10.9);
    const capped = resolveEmitCostIterations(EMIT_COST_MAX_ITERATIONS * 10);

    // Then
    expect(floored).toBe(10);
    expect(capped).toBe(EMIT_COST_MAX_ITERATIONS);
  });
});

describe("measureEmitCost", () => {
  it("should return the mean ns per call of each primitive", () => {
    // Given: each timed loop spans exactly two clock reads 1 ms apart
    const now = buildSteppingClock(1);

    // When
    const cost = measureEmitCost({ sinkOptions: { realm: RENDERER_REALM }, now, iterations: 100 });

    // Then: 1 ms / 100 calls = 10_000 ns
    expect(cost).toEqual({ gaugeNs: 10_000, counterNs: 10_000, eventNs: 10_000 });
    expect(now).toHaveBeenCalledTimes(6);
  });

  it("should run on throwaway sinks: no timers, no realm sink, no event observer", () => {
    // Given
    jest.useFakeTimers();
    const onEvent = jest.fn();

    // When
    measureEmitCost({
      sinkOptions: { realm: RENDERER_REALM, onEvent },
      now: buildSteppingClock(1),
      iterations: 10,
    });

    // Then
    expect(getTelemetry().isEnabled()).toBe(false);
    expect(onEvent).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it("should report a finite, non-negative cost with the real clock", () => {
    // Given
    const now = (): number => performance.now();

    // When
    const cost = measureEmitCost({ sinkOptions: { realm: RENDERER_REALM }, now });

    // Then
    for (const value of [cost.gaugeNs, cost.counterNs, cost.eventNs]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});
