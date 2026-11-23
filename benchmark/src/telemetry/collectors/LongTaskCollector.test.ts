// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LongTaskCollector } from "./LongTaskCollector";
import { SelfCostMeter } from "./SelfCostMeter";
import {
  buildFakeLongTaskObserver,
  buildMockTelemetry,
  buildSteppingClock,
  sumCounter,
} from "./builders/RendererCollectorsEnvBuilder";
import { LongTaskObserverConstructor } from "./types";
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

describe("LongTaskCollector", () => {
  it("should observe buffered longtask entries once started", () => {
    // Given
    const { Observer, instances } = buildFakeLongTaskObserver();
    const collector = new LongTaskCollector(buildMockTelemetry(), Observer);

    // When
    collector.start();
    collector.start();

    // Then
    expect(instances).toHaveLength(1);
    expect(instances[0]!.observe).toHaveBeenCalledWith({ type: "longtask", buffered: true });
  });

  it("should count long tasks and their summed duration", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const { Observer, instances } = buildFakeLongTaskObserver();
    const collector = new LongTaskCollector(telemetry, Observer);
    collector.start();

    // When
    instances[0]!.callback({ getEntries: () => [{ duration: 60 }, { duration: 90.5 }] });

    // Then
    expect(telemetry.counter.mock.calls).toEqual([
      ["renderer.longTasks.count", 2, "count", "renderer"],
      ["renderer.longTasks.durationMs", 150.5, "ms", "renderer"],
    ]);
  });

  it("should ignore empty entry lists", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const { Observer, instances } = buildFakeLongTaskObserver();
    new LongTaskCollector(telemetry, Observer).start();

    // When
    instances[0]!.callback({ getEntries: () => [] });

    // Then
    expect(telemetry.counter).not.toHaveBeenCalled();
  });

  it("should accumulate the time spent inside the observer callback into the self-cost meter", () => {
    // Given: every self-cost clock read advances 0.25 ms
    const telemetry = buildMockTelemetry();
    const { Observer, instances } = buildFakeLongTaskObserver();
    const meter = new SelfCostMeter(buildSteppingClock(0.25));
    new LongTaskCollector(telemetry, Observer, meter).start();

    // When: one callback with entries, one without
    instances[0]!.callback({ getEntries: () => [{ duration: 60 }] });
    instances[0]!.callback({ getEntries: () => [] });
    meter.publish(telemetry);

    // Then
    expect(sumCounter(telemetry, TELEMETRY_SELF_COST_METRICS.longTasksMs)).toBe(0.5);
  });

  it("should disconnect the observer on dispose", () => {
    // Given
    const { Observer, instances } = buildFakeLongTaskObserver();
    const collector = new LongTaskCollector(buildMockTelemetry(), Observer);
    collector.start();

    // When
    collector.dispose();

    // Then
    expect(instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  const unsupportedCases: ReadonlyArray<{
    label: string;
    Observer: LongTaskObserverConstructor | undefined;
  }> = [
    { label: "no PerformanceObserver", Observer: undefined },
    {
      label: "longtask not in supportedEntryTypes",
      Observer: buildFakeLongTaskObserver(["mark"]).Observer,
    },
  ];
  for (const { label, Observer } of unsupportedCases) {
    it(`should do nothing when unsupported (${label})`, () => {
      // Given
      const collector = new LongTaskCollector(buildMockTelemetry(), Observer);

      // When
      collector.start();

      // Then
      expect(collector.isSupported()).toBe(false);
      expect(() => {
        collector.dispose();
      }).not.toThrow();
    });
  }

  it("should swallow errors thrown by observe()", () => {
    // Given
    class Throwing {
      public static readonly supportedEntryTypes = ["longtask"];
      public observe(): void {
        throw new Error("unsupported");
      }
      public disconnect(): void {}
    }
    const collector = new LongTaskCollector(buildMockTelemetry(), Throwing);

    // When / Then
    expect(() => {
      collector.start();
    }).not.toThrow();
    expect(mockLogDebug).toHaveBeenCalled();
  });
});
