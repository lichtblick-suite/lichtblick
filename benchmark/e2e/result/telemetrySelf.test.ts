// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryRecordBuilder } from "./builders/TelemetryRecordBuilder";
import {
  TELEMETRY_SELF_TIME_METRICS,
  TELEMETRY_SELF_UA_CALLS_METRIC,
  TELEMETRY_SELF_UA_FAILURES_METRIC,
  TELEMETRY_SELF_UA_RESOLVED_METRIC,
  TELEMETRY_SELF_UA_RESOLVE_MS_METRIC,
} from "./constants";
import { meanEmitNs, summarizeTelemetrySelf } from "./telemetrySelf";

describe("summarizeTelemetrySelf", () => {
  it("should derive per-component ms/s from the counters over the window", () => {
    // Given collectors and drain self-time counters published at 1 Hz, window [1000, 3000]
    const pageRecords = [
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_TIME_METRICS.collectors, [
        [1000, 10],
        [2000, 15],
        [3000, 20],
      ]),
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_TIME_METRICS.drain, [
        [1000, 2],
        [3000, 6],
      ]),
    ];

    // When
    const self = summarizeTelemetrySelf({
      pageRecords,
      startMonotonicTs: 1000,
      endMonotonicTs: 3000,
    });

    // Then
    expect(self.windowSec).toBe(2);
    expect(self.msPerSec.byComponent).toEqual({ collectors: 5, drain: 2 });
    expect(self.msPerSec.total).toBe(7);
    expect(self.fractionOfCore).toBeCloseTo(0.007);
    expect(self.emitCostNs).toBeUndefined();
    expect(self.estimatedEmitMsPerSec).toBeUndefined();
    expect(self.uaCalls).toBe(0);
    expect(self.uaResolveMsMean).toBeUndefined();
  });

  it("should ignore self-cost counters of other realms", () => {
    // Given the same metric published by a worker realm
    const pageRecords = TelemetryRecordBuilder.counterSeries(
      TELEMETRY_SELF_TIME_METRICS.frames,
      [
        [0, 0],
        [1000, 100],
      ],
      { realm: "worker:1" },
    );

    // When
    const self = summarizeTelemetrySelf({ pageRecords, startMonotonicTs: 0, endMonotonicTs: 1000 });

    // Then
    expect(self.msPerSec.byComponent).toEqual({});
    expect(self.msPerSec.total).toBe(0);
  });

  it("should count records in the window and estimate the emit cost from the record mix", () => {
    // Given 2 gauges + 1 event inside [0, 1000] and one gauge outside, emit costs 100/200/400 ns
    const pageRecords = [
      TelemetryRecordBuilder.sample({ metric: "g", value: 1, monotonicTs: 100 }),
      TelemetryRecordBuilder.sample({ metric: "g", value: 1, monotonicTs: 900 }),
      TelemetryRecordBuilder.event({ name: "app.ready", monotonicTs: 500 }),
      TelemetryRecordBuilder.sample({ metric: "g", value: 1, monotonicTs: 1500 }),
    ];
    const emitCostNs = { gaugeNs: 100, counterNs: 200, eventNs: 400 };

    // When
    const self = summarizeTelemetrySelf({
      pageRecords,
      startMonotonicTs: 0,
      endMonotonicTs: 1000,
      emitCostNs,
    });

    // Then
    expect(self.recordsPerSec).toBe(3);
    expect(self.meanEmitNs).toBeCloseTo(200);
    expect(self.estimatedEmitMsPerSec).toBeCloseTo(0.0006);
    expect(self.fractionOfCore).toBeCloseTo(0.0006 / 1000);
  });

  it("should average the resolve latency over the resolved calls of the whole run", () => {
    // Given 4 calls (3 resolved, 1 pending at the end); the counters are published after the window
    const pageRecords = [
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_CALLS_METRIC, [
        [1000, 1],
        [5000, 4],
      ]),
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_RESOLVED_METRIC, [
        [1000, 0],
        [5000, 3],
      ]),
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_FAILURES_METRIC, [[1000, 0]]),
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_RESOLVE_MS_METRIC, [
        [1000, 0],
        [5000, 36_000],
      ]),
    ];

    // When
    const self = summarizeTelemetrySelf({ pageRecords, startMonotonicTs: 0, endMonotonicTs: 2000 });

    // Then
    expect(self.uaCalls).toBe(4);
    expect(self.uaResolved).toBe(3);
    expect(self.uaFailures).toBe(0);
    expect(self.uaResolveMsMean).toBe(12_000);
  });

  it("should omit the mean when every call was rejected (headless shell)", () => {
    // Given 1 call rejected with SecurityError: resolveMs stays 0
    const pageRecords = [
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_CALLS_METRIC, [[1000, 1]]),
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_RESOLVED_METRIC, [[1000, 0]]),
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_FAILURES_METRIC, [[1000, 1]]),
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_RESOLVE_MS_METRIC, [[1000, 0]]),
    ];

    // When
    const self = summarizeTelemetrySelf({ pageRecords, startMonotonicTs: 0, endMonotonicTs: 2000 });

    // Then: no misleading 0 ms mean
    expect(self.uaCalls).toBe(1);
    expect(self.uaFailures).toBe(1);
    expect(self.uaResolved).toBe(0);
    expect(self.uaResolveMsMean).toBeUndefined();
  });

  it("should omit the mean for page builds without the resolved counter", () => {
    // Given only calls and resolveMs (older page build)
    const pageRecords = [
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_CALLS_METRIC, [[1000, 2]]),
      ...TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_UA_RESOLVE_MS_METRIC, [[1000, 0]]),
    ];

    // When
    const self = summarizeTelemetrySelf({ pageRecords, startMonotonicTs: 0, endMonotonicTs: 2000 });

    // Then
    expect(self.uaCalls).toBe(2);
    expect(self.uaResolved).toBeUndefined();
    expect(self.uaFailures).toBeUndefined();
    expect(self.uaResolveMsMean).toBeUndefined();
  });
});

describe("meanEmitNs", () => {
  it("should fall back to the plain mean without records", () => {
    // Given / When / Then
    expect(
      meanEmitNs({ gaugeNs: 1, counterNs: 2, eventNs: 3 }, { gauges: 0, counters: 0, events: 0 }),
    ).toBe(2);
  });
});
