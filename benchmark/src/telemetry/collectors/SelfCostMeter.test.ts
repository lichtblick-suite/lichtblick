// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SelfCostMeter } from "./SelfCostMeter";
import { TELEMETRY_SELF_COST_METRICS } from "../constants";
import {
  buildMockTelemetry,
  buildSteppingClock,
  sumCounter,
} from "./builders/RendererCollectorsEnvBuilder";

describe("SelfCostMeter", () => {
  it("should publish one unlabeled renderer counter per self-cost metric, with its unit", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const meter = new SelfCostMeter(() => 0);
    meter.counter("framesMs").add(1.5);
    meter.counter("uaMemoryCalls").add(2);

    // When
    meter.publish(telemetry);

    // Then
    expect(telemetry.counter.mock.calls).toEqual([
      ["telemetry.self.timeMs.collectors", 0, "ms", "renderer"],
      ["telemetry.self.timeMs.frames", 1.5, "ms", "renderer"],
      ["telemetry.self.timeMs.longTasks", 0, "ms", "renderer"],
      ["telemetry.self.timeMs.sinkPublish", 0, "ms", "renderer"],
      ["telemetry.self.timeMs.drain", 0, "ms", "renderer"],
      ["telemetry.self.timeMs.uaMemory", 0, "ms", "renderer"],
      ["telemetry.self.uaMemory.calls", 2, "count", "renderer"],
      ["telemetry.self.uaMemory.resolveMs", 0, "ms", "renderer"],
      ["telemetry.self.uaMemory.resolved", 0, "count", "renderer"],
      ["telemetry.self.uaMemory.failures", 0, "count", "renderer"],
    ]);
    expect(telemetry.counter).toHaveBeenCalledTimes(
      Object.keys(TELEMETRY_SELF_COST_METRICS).length,
    );
  });

  it("should reset the accumulated amounts after each publish", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const meter = new SelfCostMeter(() => 0);
    meter.counter("drainMs").add(3);
    meter.publish(telemetry);
    telemetry.counter.mockClear();

    // When
    meter.counter("drainMs").add(1);
    meter.publish(telemetry);

    // Then
    expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.drainMs)).toBe(1);
  });

  it("should accumulate many measured sections into a single increment per publish", () => {
    // Given: every clock read advances 0.25 ms, so each section measures 0.25 ms
    const telemetry = buildMockTelemetry();
    const meter = new SelfCostMeter(buildSteppingClock(0.25));
    const frames = meter.counter("framesMs");

    // When
    for (let i = 0; i < 4; i++) {
      frames.addSince(frames.now());
    }
    meter.publish(telemetry);

    // Then
    expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.framesMs)).toBe(1);
    expect(
      telemetry.counter.mock.calls.filter(
        (call) => call[0] === TELEMETRY_SELF_COST_METRICS.framesMs,
      ),
    ).toHaveLength(1);
  });

  it.each([-1, 0, Number.NaN])("should ignore the non-positive amount %p", (amount) => {
    // Given
    const telemetry = buildMockTelemetry();
    const meter = new SelfCostMeter(() => 0);

    // When
    meter.counter("longTasksMs").add(amount);
    meter.publish(telemetry);

    // Then
    expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.longTasksMs)).toBe(0);
  });

  it("should time a wrapped handler, also when it throws", () => {
    // Given: every clock read advances 2 ms
    const telemetry = buildMockTelemetry();
    const meter = new SelfCostMeter(buildSteppingClock(2));
    const handler = jest.fn();
    const throwing = meter.timed("sinkPublishMs", () => {
      throw new Error("boom");
    });

    // When
    meter.timed("sinkPublishMs", handler)();
    expect(throwing).toThrow("boom");
    meter.publish(telemetry);

    // Then
    expect(handler).toHaveBeenCalledTimes(1);
    expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.sinkPublishMs)).toBe(4);
  });
});
