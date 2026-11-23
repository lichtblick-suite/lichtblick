// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { TelemetryEvent } from "@lichtblick/suite-base/util/telemetry";

import { RendererCollectors } from "./RendererCollectors";
import { SelfCostMeter } from "./SelfCostMeter";
import { TELEMETRY_SELF_COST_METRICS } from "../constants";
import {
  buildFakeLongTaskObserver,
  buildMockTelemetry,
  buildSteppingClock,
  FakeAnimationFrames,
  RendererCollectorsEnvBuilder,
  sumCounter,
} from "./builders/RendererCollectorsEnvBuilder";

const MEMORY = { usedJSHeapSize: 1, totalJSHeapSize: 2, jsHeapSizeLimit: 3 };

function buildEvent(overrides: Partial<TelemetryEvent>): TelemetryEvent {
  return {
    kind: "event",
    realm: "renderer",
    sequence: 0,
    monotonicTs: 0,
    name: "app.ready",
    phase: "instant",
    scope: "app",
    ...overrides,
  };
}

function metricNames(mock: jest.Mock): string[] {
  return mock.mock.calls.map((call) => String(call[0]));
}

describe("RendererCollectors", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should sample immediately on start and then on a 1 Hz interval", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const { env, clock } = new RendererCollectorsEnvBuilder().withMemory(MEMORY).build();
    const collectors = new RendererCollectors(telemetry, env);

    // When
    collectors.start();

    // Then
    expect(metricNames(telemetry.gauge)).toEqual([
      "renderer.jsHeap.usedBytes",
      "renderer.jsHeap.totalBytes",
      "renderer.jsHeap.limitBytes",
    ]);

    // When
    telemetry.gauge.mockClear();
    clock.now = 1000;
    jest.advanceTimersByTime(1000);

    // Then
    expect(metricNames(telemetry.gauge)).toEqual([
      "renderer.jsHeap.usedBytes",
      "renderer.jsHeap.totalBytes",
      "renderer.jsHeap.limitBytes",
      "renderer.fps",
    ]);
    expect(metricNames(telemetry.counter)).toEqual([
      "renderer.frames",
      "renderer.lateFrames",
      ...Object.values(TELEMETRY_SELF_COST_METRICS),
    ]);
    collectors.dispose();
  });

  it("should start the long task observer and the RAF loop", () => {
    // Given
    const frames = new FakeAnimationFrames();
    const { Observer, instances } = buildFakeLongTaskObserver();
    const { env } = new RendererCollectorsEnvBuilder()
      .withFrames(frames)
      .withLongTaskObserver(Observer)
      .build();
    const collectors = new RendererCollectors(buildMockTelemetry(), env);

    // When
    collectors.start();

    // Then
    expect(instances).toHaveLength(1);
    expect(frames.hasPending()).toBe(true);
    collectors.dispose();
  });

  it("should arm frame.firstUseful on datasource.firstMessage (also from other realms)", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const frames = new FakeAnimationFrames();
    const { env } = new RendererCollectorsEnvBuilder().withFrames(frames).build();
    const collectors = new RendererCollectors(telemetry, env);
    collectors.start();
    const labels = { sourceId: "mcap-real-pipeline" };

    // When
    collectors.handleEvent(
      buildEvent({ realm: "worker:0", name: "datasource.firstMessage", scope: "pipeline", labels }),
    );
    frames.fireFrame(16);

    // Then
    expect(telemetry.event).toHaveBeenCalledWith(
      "frame.firstUseful",
      "instant",
      "renderer",
      labels,
    );
    collectors.dispose();
  });

  it("should measure UA-specific memory at start and on datasource open/close end events only", () => {
    // Given
    const measure = jest.fn(async () => ({ bytes: 1 }));
    const { env } = new RendererCollectorsEnvBuilder().withUaMemory(measure).build();
    const collectors = new RendererCollectors(buildMockTelemetry(), env);

    // When
    collectors.start();

    // Then
    expect(measure).toHaveBeenCalledTimes(1);

    // When: start phases and other events do not trigger a measurement
    collectors.handleEvent(buildEvent({ name: "datasource.open", phase: "start" }));
    collectors.handleEvent(buildEvent({ name: "playback", phase: "end" }));

    // Then
    expect(measure).toHaveBeenCalledTimes(1);
    collectors.dispose();
  });

  it("should trigger a UA-specific memory measurement on datasource.close end", async () => {
    // Given
    const measure = jest.fn(async () => ({ bytes: 1 }));
    const { env } = new RendererCollectorsEnvBuilder().withUaMemory(measure).build();
    const collectors = new RendererCollectors(buildMockTelemetry(), env);
    collectors.start();
    await Promise.resolve();
    await Promise.resolve();

    // When
    collectors.handleEvent(buildEvent({ name: "datasource.close", phase: "end" }));

    // Then
    expect(measure).toHaveBeenCalledTimes(2);
    collectors.dispose();
  });

  it("should stop the interval, RAF loop and observer on dispose", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const frames = new FakeAnimationFrames();
    const { Observer, instances } = buildFakeLongTaskObserver();
    const { env } = new RendererCollectorsEnvBuilder()
      .withMemory(MEMORY)
      .withFrames(frames)
      .withLongTaskObserver(Observer)
      .build();
    const collectors = new RendererCollectors(telemetry, env);
    collectors.start();

    // When
    collectors.dispose();
    telemetry.gauge.mockClear();
    jest.advanceTimersByTime(5_000);
    collectors.handleEvent(buildEvent({ name: "datasource.firstMessage" }));

    // Then
    expect(telemetry.gauge).not.toHaveBeenCalled();
    expect(frames.hasPending()).toBe(false);
    expect(instances[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("should never start after dispose", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const { env } = new RendererCollectorsEnvBuilder().withMemory(MEMORY).build();
    const collectors = new RendererCollectors(telemetry, env);

    // When
    collectors.dispose();
    collectors.start();

    // Then
    expect(telemetry.gauge).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  describe("self cost", () => {
    it("should time the 1 Hz tick and publish the shared meter on it", () => {
      // Given: every clock read advances 1 ms; the installer recorded 3 ms of drain time
      const telemetry = buildMockTelemetry();
      const { env } = new RendererCollectorsEnvBuilder()
        .withFrames(undefined)
        .withNow(buildSteppingClock(1))
        .build();
      const selfCost = new SelfCostMeter(env.now);
      selfCost.counter("drainMs").add(3);
      const collectors = new RendererCollectors(telemetry, env, { selfCost });
      collectors.start();

      // When
      jest.advanceTimersByTime(1000);

      // Then: one tick = two clock reads around (heap, frames, UA) = 1 ms
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.collectorsMs)).toBe(1);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.drainMs)).toBe(3);
      collectors.dispose();
    });

    it("should publish pending self cost on dispose", () => {
      // Given
      const telemetry = buildMockTelemetry();
      const { env } = new RendererCollectorsEnvBuilder().withFrames(undefined).build();
      const selfCost = new SelfCostMeter(env.now);
      const collectors = new RendererCollectors(telemetry, env, { selfCost });
      collectors.start();
      selfCost.counter("drainMs").add(2);

      // When
      collectors.dispose();

      // Then
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.drainMs)).toBe(2);
    });
  });
});
