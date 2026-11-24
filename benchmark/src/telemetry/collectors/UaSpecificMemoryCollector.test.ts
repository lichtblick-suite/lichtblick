// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SelfCostMeter } from "./SelfCostMeter";
import { UaSpecificMemoryCollector } from "./UaSpecificMemoryCollector";
import {
  buildMockTelemetry,
  MockTelemetry,
  sumCounter,
} from "./builders/RendererCollectorsEnvBuilder";
import { UserAgentSpecificMemoryResult } from "./types";
import { TELEMETRY_SELF_COST_METRICS } from "../constants";

const mockLogDebug = jest.fn();

jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: {
    getLogger: () => ({
      debug: (...args: unknown[]) => mockLogDebug(...args),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

type Deferred = {
  promise: Promise<UserAgentSpecificMemoryResult>;
  resolve: (result: UserAgentSpecificMemoryResult) => void;
  reject: (err: Error) => void;
};

function deferred(): Deferred {
  let resolve!: Deferred["resolve"];
  let reject!: Deferred["reject"];
  const promise = new Promise<UserAgentSpecificMemoryResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function setup(options: { crossOriginIsolated?: boolean; withApi?: boolean } = {}): {
  telemetry: MockTelemetry;
  measure: jest.Mock<Promise<UserAgentSpecificMemoryResult>, []>;
  pending: Deferred[];
  clock: { now: number };
  collector: UaSpecificMemoryCollector;
} {
  const telemetry = buildMockTelemetry();
  const pending: Deferred[] = [];
  const measure = jest.fn(async () => {
    const d = deferred();
    pending.push(d);
    return await d.promise;
  });
  const clock = { now: 0 };
  const collector = new UaSpecificMemoryCollector(telemetry, {
    now: () => clock.now,
    performance: options.withApi === false ? {} : { measureUserAgentSpecificMemory: measure },
    crossOriginIsolated: options.crossOriginIsolated ?? true,
  });
  return { telemetry, measure, pending, clock, collector };
}

describe("UaSpecificMemoryCollector", () => {
  it("should publish the measured bytes as a gauge", async () => {
    // Given
    const { telemetry, pending, collector } = setup();

    // When
    collector.measure();
    pending[0]!.resolve({ bytes: 1234 });
    await flushPromises();

    // Then
    expect(telemetry.gauge).toHaveBeenCalledWith(
      "renderer.uaSpecificMemory.bytes",
      1234,
      "bytes",
      "renderer",
    );
  });

  it("should never have more than one measurement in flight and coalesce requests", async () => {
    // Given
    const { measure, pending, collector } = setup();
    collector.measure();

    // When
    collector.measure();
    collector.measure();

    // Then
    expect(measure).toHaveBeenCalledTimes(1);

    // When the first settles, exactly one coalesced follow-up starts
    pending[0]!.resolve({ bytes: 1 });
    await flushPromises();

    // Then
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it("should space periodic measurements at least 10 s apart", async () => {
    // Given
    const { measure, pending, clock, collector } = setup();
    collector.measure();
    pending[0]!.resolve({ bytes: 1 });
    await flushPromises();

    // When
    clock.now = 9_999;
    collector.maybeMeasurePeriodic();

    // Then
    expect(measure).toHaveBeenCalledTimes(1);

    // When
    clock.now = 10_000;
    collector.maybeMeasurePeriodic();

    // Then
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it("should swallow measurement errors", async () => {
    // Given
    const { telemetry, pending, collector } = setup();

    // When
    collector.measure();
    pending[0]!.reject(new Error("SecurityError"));
    await flushPromises();

    // Then
    expect(telemetry.gauge).not.toHaveBeenCalled();
    expect(mockLogDebug).toHaveBeenCalled();
  });

  it("should report itself unsupported and stop calling after a SecurityError rejection", async () => {
    // Given: the browser exposes the method but does not provide it (chromium-headless-shell)
    const { measure, pending, clock, collector } = setup();
    collector.measure();
    collector.measure();

    // When
    pending[0]!.reject(
      Object.assign(new Error("performance.measureUserAgentSpecificMemory is not available."), {
        name: "SecurityError",
      }),
    );
    await flushPromises();
    clock.now = 60_000;
    collector.maybeMeasurePeriodic();
    collector.measure();

    // Then: neither the coalesced follow-up nor later requests call it again
    expect(measure).toHaveBeenCalledTimes(1);
    expect(collector.isSupported()).toBe(false);
  });

  it("should keep measuring after a rejection other than SecurityError", async () => {
    // Given
    const { measure, pending, collector } = setup();
    collector.measure();

    // When
    pending[0]!.reject(new Error("aborted"));
    await flushPromises();
    collector.measure();

    // Then
    expect(measure).toHaveBeenCalledTimes(2);
    expect(collector.isSupported()).toBe(true);
  });

  const unsupportedCases: ReadonlyArray<{
    label: string;
    crossOriginIsolated?: boolean;
    withApi?: boolean;
  }> = [
    { label: "not cross-origin isolated", crossOriginIsolated: false },
    { label: "API missing", withApi: false },
  ];
  it.each(unsupportedCases)("should do nothing when $label", ({ crossOriginIsolated, withApi }) => {
    // Given
    const { measure, collector } = setup({ crossOriginIsolated, withApi });

    // When
    collector.measure();
    collector.maybeMeasurePeriodic();

    // Then
    expect(collector.isSupported()).toBe(false);
    expect(measure).not.toHaveBeenCalled();
  });

  it("should not record or start new measurements after dispose", async () => {
    // Given
    const { telemetry, measure, pending, collector } = setup();
    collector.measure();
    collector.measure();

    // When
    collector.dispose();
    pending[0]!.resolve({ bytes: 1 });
    await flushPromises();
    collector.measure();

    // Then
    expect(measure).toHaveBeenCalledTimes(1);
    expect(telemetry.gauge).not.toHaveBeenCalled();
  });

  describe("pause and resume", () => {
    it("should drop the coalesced follow-up and the late result while paused", async () => {
      // Given
      const { telemetry, measure, pending, collector } = setup();
      collector.measure();
      collector.measure();

      // When
      collector.pause();
      pending[0]!.resolve({ bytes: 1 });
      await flushPromises();
      collector.measure();
      collector.maybeMeasurePeriodic();

      // Then
      expect(measure).toHaveBeenCalledTimes(1);
      expect(telemetry.gauge).not.toHaveBeenCalled();
      expect(collector.callCount()).toBe(1);
    });

    it("should not measure on resume and keep the global spacing of periodic measurements", async () => {
      // Given: a measurement started at t = 0 and resolved
      const { measure, pending, clock, collector } = setup();
      collector.measure();
      pending[0]!.resolve({ bytes: 1 });
      await flushPromises();
      collector.pause();
      clock.now = 4000;

      // When: resumed 4 s later, then periodic requests at 4 s and 10 s
      collector.resume();
      const callsAtResume = measure.mock.calls.length;
      collector.maybeMeasurePeriodic();
      const callsBeforeInterval = measure.mock.calls.length;
      clock.now = 10_000;
      collector.maybeMeasurePeriodic();

      // Then
      expect(callsAtResume).toBe(1);
      expect(callsBeforeInterval).toBe(1);
      expect(measure).toHaveBeenCalledTimes(2);
      expect(collector.callCount()).toBe(2);
    });
  });

  describe("self cost", () => {
    function setupWithMeter(): {
      telemetry: MockTelemetry;
      selfClock: { now: number };
      pending: Deferred[];
      meter: SelfCostMeter;
      collector: UaSpecificMemoryCollector;
    } {
      const telemetry = buildMockTelemetry();
      const selfClock = { now: 0 };
      const pending: Deferred[] = [];
      // The synchronous part of each call takes 2 ms on the self-cost clock.
      const measure = jest.fn(async () => {
        selfClock.now += 2;
        const d = deferred();
        pending.push(d);
        return await d.promise;
      });
      const meter = new SelfCostMeter(() => selfClock.now);
      const collector = new UaSpecificMemoryCollector(
        telemetry,
        {
          now: () => 0,
          performance: { measureUserAgentSpecificMemory: measure },
          crossOriginIsolated: true,
        },
        meter,
      );
      return { telemetry, selfClock, pending, meter, collector };
    }

    it("should count calls, their synchronous time and the call -> resolve latency", async () => {
      // Given
      const { telemetry, selfClock, pending, meter, collector } = setupWithMeter();
      selfClock.now = 10;

      // When: called at 10 (returns at 12), resolved at 50
      collector.measure();
      selfClock.now = 50;
      pending[0]!.resolve({ bytes: 1 });
      await flushPromises();
      meter.publish(telemetry);

      // Then
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryCalls)).toBe(1);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryMs)).toBe(2);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryResolveMs)).toBe(40);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryResolved)).toBe(1);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryFailures)).toBe(0);
    });

    it("should count rejected calls as failures without resolve latency", async () => {
      // Given
      const { telemetry, pending, meter, collector } = setupWithMeter();

      // When
      collector.measure();
      pending[0]!.reject(new Error("no GC yet"));
      await flushPromises();
      meter.publish(telemetry);

      // Then
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryCalls)).toBe(1);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryMs)).toBe(2);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryResolveMs)).toBe(0);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryResolved)).toBe(0);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryFailures)).toBe(1);
    });

    it("should count a call still in flight neither as resolved nor as failed", () => {
      // Given
      const { telemetry, meter, collector } = setupWithMeter();

      // When
      collector.measure();
      meter.publish(telemetry);

      // Then
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryCalls)).toBe(1);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryResolved)).toBe(0);
      expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.uaMemoryFailures)).toBe(0);
    });
  });
});
