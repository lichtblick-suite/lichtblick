// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FrameCollector } from "./FrameCollector";
import { SelfCostMeter } from "./SelfCostMeter";
import { TELEMETRY_SELF_COST_METRICS } from "../constants";
import {
  buildMockTelemetry,
  buildSteppingClock,
  FakeAnimationFrames,
  MockTelemetry,
  sumCounter,
} from "./builders/RendererCollectorsEnvBuilder";

function setup(lateFrameThresholdMs?: number): {
  telemetry: MockTelemetry;
  frames: FakeAnimationFrames;
  clock: { now: number };
  collector: FrameCollector;
} {
  const telemetry = buildMockTelemetry();
  const frames = new FakeAnimationFrames();
  const clock = { now: 0 };
  const collector = new FrameCollector(
    telemetry,
    {
      now: () => clock.now,
      requestAnimationFrame: frames.requestAnimationFrame,
      cancelAnimationFrame: frames.cancelAnimationFrame,
    },
    lateFrameThresholdMs,
  );
  return { telemetry, frames, clock, collector };
}

describe("FrameCollector", () => {
  it("should publish fps and late frames for the elapsed window", () => {
    // Given: 4 frames, deltas 16, 40 (late), 16
    const { telemetry, frames, clock, collector } = setup();
    collector.start();
    frames.fireFrame(100);
    frames.fireFrame(116);
    frames.fireFrame(156);
    frames.fireFrame(172);

    // When
    clock.now = 500;
    collector.publish();

    // Then
    expect(telemetry.gauge).toHaveBeenCalledWith("renderer.fps", 8, "fps", "renderer");
    expect(telemetry.counter).toHaveBeenCalledWith("renderer.frames", 4, "count", "renderer");
    expect(telemetry.counter).toHaveBeenCalledWith("renderer.lateFrames", 1, "count", "renderer");
  });

  it("should count late frames against a runtime threshold when one is given", () => {
    // Given: a 120 Hz threshold (12.5 ms); deltas 8, 16 (late), 8
    const { telemetry, frames, clock, collector } = setup(12.5);
    collector.start();
    frames.fireFrame(100);
    frames.fireFrame(108);
    frames.fireFrame(124);
    frames.fireFrame(132);

    // When
    clock.now = 1000;
    collector.publish();

    // Then
    expect(telemetry.counter).toHaveBeenCalledWith("renderer.lateFrames", 1, "count", "renderer");
  });

  it("should reset accumulators after each publish", () => {
    // Given
    const { telemetry, frames, clock, collector } = setup();
    collector.start();
    frames.fireFrame(0);
    frames.fireFrame(100);
    clock.now = 1000;
    collector.publish();
    telemetry.gauge.mockClear();
    telemetry.counter.mockClear();

    // When: one on-time frame in the next window
    frames.fireFrame(116);
    clock.now = 2000;
    collector.publish();

    // Then
    expect(telemetry.gauge).toHaveBeenCalledWith("renderer.fps", 1, "fps", "renderer");
    expect(telemetry.counter).toHaveBeenCalledWith("renderer.frames", 1, "count", "renderer");
    expect(telemetry.counter).toHaveBeenCalledWith("renderer.lateFrames", 0, "count", "renderer");
  });

  it("should not count the first frame of a run as late", () => {
    // Given
    const { telemetry, frames, clock, collector } = setup();
    collector.start();

    // When
    frames.fireFrame(10_000);
    clock.now = 1000;
    collector.publish();

    // Then
    expect(telemetry.counter).toHaveBeenCalledWith("renderer.lateFrames", 0, "count", "renderer");
  });

  it("should reuse the same RAF callback for every frame", () => {
    // Given
    const { frames, collector } = setup();
    collector.start();

    // When
    frames.fireFrame(0);
    frames.fireFrame(16);

    // Then
    const callbacks = new Set(frames.requestAnimationFrame.mock.calls.map((call) => call[0]));
    expect(callbacks.size).toBe(1);
  });

  it("should emit frame.firstUseful once, on the next frame after the first message", () => {
    // Given
    const { telemetry, frames, collector } = setup();
    collector.start();
    frames.fireFrame(0);
    const labels = { sourceId: "mcap-real-pipeline" };

    // When
    collector.markFirstMessage(labels);

    // Then: not before the next frame
    expect(telemetry.event).not.toHaveBeenCalled();

    // When
    frames.fireFrame(16);
    collector.markFirstMessage(labels);
    frames.fireFrame(32);

    // Then
    expect(telemetry.event).toHaveBeenCalledTimes(1);
    expect(telemetry.event).toHaveBeenCalledWith(
      "frame.firstUseful",
      "instant",
      "renderer",
      labels,
    );
  });

  it("should stop the RAF loop and publishing on dispose", () => {
    // Given
    const { telemetry, frames, collector } = setup();
    collector.start();

    // When
    collector.dispose();
    collector.publish();
    collector.markFirstMessage();

    // Then
    expect(frames.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.hasPending()).toBe(false);
    expect(collector.isLoopRunning()).toBe(false);
    expect(telemetry.gauge).not.toHaveBeenCalled();
    expect(telemetry.counter).not.toHaveBeenCalled();
  });

  it("should do nothing without requestAnimationFrame", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const collector = new FrameCollector(telemetry, { now: () => 0 });

    // When
    collector.start();
    collector.markFirstMessage();
    collector.publish();

    // Then
    expect(collector.isSupported()).toBe(false);
    expect(telemetry.gauge).not.toHaveBeenCalled();
    expect(telemetry.event).not.toHaveBeenCalled();
  });

  it("should accumulate the time spent inside the RAF callback into the self-cost meter", () => {
    // Given: the self-cost clock advances 0.5 ms per read; the collector's own clock is static
    const telemetry = buildMockTelemetry();
    const frames = new FakeAnimationFrames();
    const meter = new SelfCostMeter(buildSteppingClock(0.5));
    const collector = new FrameCollector(
      telemetry,
      {
        now: () => 0,
        requestAnimationFrame: frames.requestAnimationFrame,
        cancelAnimationFrame: frames.cancelAnimationFrame,
      },
      undefined,
      meter,
    );
    collector.start();

    // When: three frames, then one after dispose (not running: not timed)
    frames.fireFrame(16);
    frames.fireFrame(32);
    frames.fireFrame(48);
    collector.dispose();
    frames.fireFrame(64);
    meter.publish(telemetry);

    // Then
    expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.framesMs)).toBe(1.5);
  });
});
