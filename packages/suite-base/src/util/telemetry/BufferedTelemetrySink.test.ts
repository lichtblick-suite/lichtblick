// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

import { BufferedTelemetrySink } from "./BufferedTelemetrySink";
import { TelemetryBuilder } from "./builders/TelemetryBuilder";
import { DEFAULT_MAX_SERIES_PER_METRIC, TELEMETRY_SELF_METRICS } from "./constants";
import {
  BufferedTelemetrySinkOptions,
  TelemetryBatch,
  TelemetryEvent,
  TelemetryRecord,
  TelemetrySample,
} from "./types";

const REALM = "renderer";

function setup(overrides: Partial<BufferedTelemetrySinkOptions> = {}) {
  let nowMs = BasicBuilder.number({ min: 1_000_000, max: 2_000_000 });
  const timerHandle = { id: BasicBuilder.string() };
  const setIntervalMock = jest.fn(
    (_handler: () => void, _intervalMs: number): unknown => timerHandle,
  );
  const clearIntervalMock = jest.fn((_handle: unknown): void => {});
  const sink = new BufferedTelemetrySink({
    realm: REALM,
    now: () => nowMs,
    setInterval: setIntervalMock,
    clearInterval: clearIntervalMock,
    ...overrides,
  });
  return {
    sink,
    timerHandle,
    setIntervalMock,
    clearIntervalMock,
    now: () => nowMs,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

function samplesOf(records: readonly TelemetryRecord[], metric: string): TelemetrySample[] {
  return records.filter(
    (record): record is TelemetrySample => record.kind === "sample" && record.metric === metric,
  );
}

function eventsOf(records: readonly TelemetryRecord[]): TelemetryEvent[] {
  return records.filter((record): record is TelemetryEvent => record.kind === "event");
}

function rejectedCount(batch: TelemetryBatch, reason: string): number | undefined {
  return samplesOf(batch.records, TELEMETRY_SELF_METRICS.rejectedRecords).find(
    (sample) => sample.labels?.reason === reason,
  )?.value;
}

describe("BufferedTelemetrySink", () => {
  describe("construction", () => {
    it("is enabled and empty after construction", () => {
      // Given / When
      const { sink } = setup();

      // Then
      expect(sink.isEnabled()).toBe(true);
      expect(sink.pendingCount()).toBe(0);
      expect(sink.drain()).toEqual({ realm: REALM, records: [], dropped: 0 });
    });

    it.each([
      { capacity: 0 },
      { capacity: 1.5 },
      { publishIntervalMs: 0 },
      { publishIntervalMs: Number.NaN },
      { maxSeriesPerMetric: 0 },
    ])("rejects invalid options %o", (options) => {
      // Given / When
      const create = () => new BufferedTelemetrySink({ realm: REALM, ...options });

      // Then
      expect(create).toThrow();
    });
  });

  describe("gauge", () => {
    it("publishes the last value of each series at every publish", () => {
      // Given
      const { sink, now } = setup();
      const metric = TelemetryBuilder.metric();
      sink.gauge(metric, 1, "bytes", "renderer");
      sink.gauge(metric, 2, "bytes", "renderer");
      sink.gauge(metric, 3, "bytes", "renderer");

      // When
      sink.publishNow();
      sink.publishNow();

      // Then
      const samples = samplesOf(sink.drain().records, metric);
      expect(samples).toHaveLength(2);
      for (const sample of samples) {
        expect(sample).toEqual({
          kind: "sample",
          realm: REALM,
          sequence: expect.any(Number),
          monotonicTs: now(),
          metric,
          value: 3,
          unit: "bytes",
          scope: "renderer",
          metricType: "gauge",
        });
      }
    });

    it("keeps one series per label set and attaches the labels", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.gauge(metric, 10, "bytes", "worker", { sourceId: "a" });
      sink.gauge(metric, 20, "bytes", "worker", { sourceId: "b" });

      // When
      sink.publishNow();

      // Then
      const samples = samplesOf(sink.drain().records, metric);
      expect(samples.map((s) => [s.labels, s.value])).toEqual([
        [{ sourceId: "a" }, 10],
        [{ sourceId: "b" }, 20],
      ]);
    });

    it("copies labels so later mutation by the caller has no effect", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      const labels: Record<string, string> = { sourceId: "a" };
      sink.gauge(metric, 1, "bytes", "worker", labels);

      // When
      labels.sourceId = "mutated";
      sink.publishNow();

      // Then
      expect(samplesOf(sink.drain().records, metric)[0]?.labels).toEqual({ sourceId: "a" });
    });

    it("rejects and counts non-finite values", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();

      // When
      sink.gauge(metric, Number.NaN, "bytes", "renderer");
      sink.gauge(metric, Number.POSITIVE_INFINITY, "bytes", "renderer");
      sink.publishNow();

      // Then
      const batch = sink.drain();
      expect(samplesOf(batch.records, metric)).toHaveLength(0);
      expect(rejectedCount(batch, "invalidValue")).toBe(2);
    });
  });

  describe("counter", () => {
    it("publishes the cumulative value and the delta since the previous publish", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.counter(metric, 2, "count", "pipeline");
      sink.counter(metric, 3, "count", "pipeline");

      // When
      sink.publishNow();
      sink.counter(metric, 4, "count", "pipeline");
      sink.publishNow();

      // Then
      const samples = samplesOf(sink.drain().records, metric);
      expect(samples.map((s) => [s.metricType, s.value, s.delta])).toEqual([
        ["counter", 5, 5],
        ["counter", 9, 4],
      ]);
    });

    it("publishes a zero-delta series once, then skips it until it changes", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.counter(metric, 0, "count", "pipeline");

      // When
      sink.publishNow();
      sink.publishNow();
      sink.counter(metric, 1, "count", "pipeline");
      sink.publishNow();

      // Then
      const samples = samplesOf(sink.drain().records, metric);
      expect(samples.map((s) => [s.value, s.delta])).toEqual([
        [0, 0],
        [1, 1],
      ]);
    });

    it("rejects and counts negative, NaN and infinite increments without changing the total", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.counter(metric, 5, "count", "pipeline");

      // When
      sink.counter(metric, -1, "count", "pipeline");
      sink.counter(metric, Number.NaN, "count", "pipeline");
      sink.counter(metric, Number.POSITIVE_INFINITY, "count", "pipeline");
      sink.publishNow();

      // Then
      const batch = sink.drain();
      const [sample] = samplesOf(batch.records, metric);
      expect(sample?.value).toBe(5);
      expect(sample?.delta).toBe(5);
      expect(rejectedCount(batch, "invalidValue")).toBe(3);
    });

    it("should reject an increment that would overflow the total to Infinity without changing it", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.counter(metric, Number.MAX_VALUE, "count", "pipeline");

      // When
      sink.counter(metric, Number.MAX_VALUE, "count", "pipeline");
      sink.publishNow();

      // Then
      const batch = sink.drain();
      const [sample] = samplesOf(batch.records, metric);
      expect(sample?.value).toBe(Number.MAX_VALUE);
      expect(rejectedCount(batch, "invalidValue")).toBe(1);
    });

    it("never publishes a negative delta", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();

      // When
      for (let i = 0; i < 20; i++) {
        sink.counter(metric, BasicBuilder.sample([-3, 0, 2, Number.NaN]), "count", "app");
        sink.publishNow();
      }

      // Then
      for (const sample of samplesOf(sink.drain().records, metric)) {
        expect(sample.delta).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("observe", () => {
    function observationSamples(records: readonly TelemetryRecord[], metric: string) {
      return {
        count: samplesOf(records, `${metric}.count`),
        sum: samplesOf(records, `${metric}.sum`),
        max: samplesOf(records, `${metric}.max`),
      };
    }

    it("should aggregate count, sum and max within a publish window", () => {
      // Given
      const { sink, now } = setup();
      const metric = TelemetryBuilder.metric();
      const labels = { panelId: "Plot!a", panelType: "Plot" };
      sink.observe(metric, 2, "ms", "panel", labels);
      sink.observe(metric, 7, "ms", "panel", labels);
      sink.observe(metric, 3, "ms", "panel", labels);

      // When
      sink.publishNow();

      // Then
      const records = sink.drain().records;
      const { count, sum, max } = observationSamples(records, metric);
      const common = { kind: "sample", realm: REALM, monotonicTs: now(), scope: "panel", labels };
      expect(count).toEqual([
        {
          ...common,
          sequence: expect.any(Number),
          metric: `${metric}.count`,
          value: 3,
          unit: "count",
          metricType: "counter",
          delta: 3,
        },
      ]);
      expect(sum).toEqual([
        {
          ...common,
          sequence: expect.any(Number),
          metric: `${metric}.sum`,
          value: 12,
          unit: "ms",
          metricType: "counter",
          delta: 12,
        },
      ]);
      expect(max).toEqual([
        {
          ...common,
          sequence: expect.any(Number),
          metric: `${metric}.max`,
          value: 7,
          unit: "ms",
          metricType: "gauge",
        },
      ]);
      expect([count[0]!.sequence + 1, count[0]!.sequence + 2]).toEqual([
        sum[0]!.sequence,
        max[0]!.sequence,
      ]);
      expect(samplesOf(records, metric)).toHaveLength(0);
    });

    it("should reset the window between publishes while keeping cumulative counters", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.observe(metric, 10, "ms", "pipeline");
      sink.observe(metric, 4, "ms", "pipeline");
      sink.publishNow();

      // When
      sink.observe(metric, 1, "ms", "pipeline");
      sink.publishNow();

      // Then
      const { count, sum, max } = observationSamples(sink.drain().records, metric);
      expect(count.map((s) => [s.value, s.delta])).toEqual([
        [2, 2],
        [3, 1],
      ]);
      expect(sum.map((s) => [s.value, s.delta])).toEqual([
        [14, 14],
        [15, 1],
      ]);
      expect(max.map((s) => s.value)).toEqual([10, 1]);
    });

    it("should emit nothing for a series whose window is empty", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.observe(metric, 5, "ms", "pipeline");
      sink.publishNow();
      sink.drain();

      // When
      sink.publishNow();
      sink.publishNow();

      // Then
      const { count, sum, max } = observationSamples(sink.drain().records, metric);
      expect([count, sum, max]).toEqual([[], [], []]);
    });

    it("should accept zero and reject negative, NaN and infinite values without aggregating them", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.observe(metric, 0, "ms", "pipeline");

      // When
      sink.observe(metric, -1, "ms", "pipeline");
      sink.observe(metric, Number.NaN, "ms", "pipeline");
      sink.observe(metric, Number.POSITIVE_INFINITY, "ms", "pipeline");
      sink.publishNow();

      // Then
      const batch = sink.drain();
      const { count, sum, max } = observationSamples(batch.records, metric);
      expect(count.map((s) => s.value)).toEqual([1]);
      expect(sum.map((s) => s.value)).toEqual([0]);
      expect(max.map((s) => s.value)).toEqual([0]);
      expect(rejectedCount(batch, "invalidValue")).toBe(3);
    });

    it("should cap label sets per metric and reject unknown label keys", () => {
      // Given
      const maxSeriesPerMetric = 2;
      const { sink } = setup({ maxSeriesPerMetric });
      const metric = TelemetryBuilder.metric();
      const attempts = 5;

      // When
      for (let i = 0; i < attempts; i++) {
        sink.observe(metric, i, "ms", "panel", { panelId: `Plot!${i}` });
      }
      sink.observe(TelemetryBuilder.metric(), 1, "ms", "panel", { title: "My plot" });
      sink.publishNow();

      // Then
      const batch = sink.drain();
      const { count } = observationSamples(batch.records, metric);
      expect(count.map((s) => s.labels?.panelId)).toEqual(["Plot!0", "Plot!1"]);
      expect(rejectedCount(batch, "cardinality")).toBe(attempts - maxSeriesPerMetric);
      expect(rejectedCount(batch, "unknownLabel")).toBe(1);
    });

    it("should count each observation series once in seriesCount", () => {
      // Given
      const { sink } = setup();
      sink.observe(TelemetryBuilder.metric(), 1, "ms", "pipeline");
      sink.observe(TelemetryBuilder.metric(), 1, "ms", "pipeline");

      // When
      sink.publishNow();

      // Then
      const [seriesCount] = samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.seriesCount);
      // 2 observation series + the seriesCount gauge itself
      expect(seriesCount?.value).toBe(3);
    });

    it("should publish the pending window on dispose and ignore later observations", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      sink.observe(metric, 6, "bytes", "worker");

      // When
      sink.dispose();
      sink.observe(metric, 9, "bytes", "worker");
      sink.publishNow();

      // Then
      const { count, sum, max } = observationSamples(sink.drain().records, metric);
      expect(count.map((s) => [s.value, s.delta])).toEqual([[1, 1]]);
      expect(sum.map((s) => [s.value, s.delta, s.unit])).toEqual([[6, 6, "bytes"]]);
      expect(max.map((s) => [s.value, s.unit])).toEqual([[6, "bytes"]]);
    });
  });

  describe("publishNow", () => {
    it("stamps all samples of one publish with the same timestamp", () => {
      // Given
      const { sink, now, advance } = setup();
      sink.gauge(TelemetryBuilder.metric(), 1, "bytes", "renderer");
      sink.counter(TelemetryBuilder.metric(), 1, "count", "renderer");
      advance(BasicBuilder.number({ min: 1, max: 100 }));

      // When
      sink.publishNow();

      // Then
      const records = sink.drain().records;
      expect(records.length).toBeGreaterThanOrEqual(3);
      for (const record of records) {
        expect(record.monotonicTs).toBe(now());
      }
    });

    it("publishes the seriesCount self gauge", () => {
      // Given
      const { sink } = setup();
      sink.gauge(TelemetryBuilder.metric(), 1, "bytes", "renderer");
      sink.counter(TelemetryBuilder.metric(), 1, "count", "renderer");

      // When
      sink.publishNow();

      // Then
      const [seriesCount] = samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.seriesCount);
      // 1 gauge + 1 counter + the seriesCount gauge itself
      expect(seriesCount?.value).toBe(3);
      expect(seriesCount?.scope).toBe("telemetry");
    });
  });

  describe("event", () => {
    it("records the event immediately and notifies onEvent synchronously", () => {
      // Given
      const onEvent = jest.fn();
      const { sink, now } = setup({ onEvent });

      // When
      sink.event("datasource.open", "start", "pipeline", { sourceId: "mcap" });

      // Then
      const expected: TelemetryEvent = {
        kind: "event",
        realm: REALM,
        sequence: 0,
        monotonicTs: now(),
        name: "datasource.open",
        phase: "start",
        scope: "pipeline",
        labels: { sourceId: "mcap" },
      };
      expect(sink.drain().records).toEqual([expected]);
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(expected);
    });

    it("should keep the event and log only the first failure when onEvent throws", () => {
      // Given
      const onEvent = jest.fn(() => {
        throw new Error("observer failed");
      });
      const { sink } = setup({ onEvent });

      // When
      sink.event("app.ready", "instant", "app");
      sink.event("layout.applied", "instant", "app");

      // Then
      expect(eventsOf(sink.drain().records).map((event) => event.name)).toEqual([
        "app.ready",
        "layout.applied",
      ]);
      expect(console.warn).toHaveBeenCalledTimes(1);
      (console.warn as jest.Mock).mockClear();
    });

    it("omits labels when none are given", () => {
      // Given
      const { sink } = setup();

      // When
      sink.event("app.ready", "instant", "app");

      // Then
      const [event] = eventsOf(sink.drain().records);
      expect(event).not.toHaveProperty("labels");
    });
  });

  describe("sequence", () => {
    it("assigns contiguous sequence numbers starting at 0 across events and samples", () => {
      // Given
      const { sink } = setup();
      sink.gauge(TelemetryBuilder.metric(), 1, "bytes", "renderer");
      sink.counter(TelemetryBuilder.metric(), 1, "count", "renderer");

      // When
      sink.event("app.ready", "instant", "app");
      sink.publishNow();
      sink.event("playback", "start", "pipeline");

      // Then
      const sequences = sink.drain().records.map((record) => record.sequence);
      expect(sequences).toEqual(sequences.map((_, i) => i));
    });
  });

  describe("ring buffer and drain", () => {
    it("drops the oldest records when full and reports the drop count once", () => {
      // Given
      const { sink } = setup({ capacity: 3 });

      // When
      for (let i = 0; i < 5; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }
      const first = sink.drain();
      const second = sink.drain();

      // Then
      expect(first.records.map((r) => r.sequence)).toEqual([2, 3, 4]);
      expect(first.dropped).toBe(2);
      expect(second).toEqual({ realm: REALM, records: [], dropped: 0 });
    });

    it("reports own drops through the droppedRecords self counter", () => {
      // Given
      const { sink } = setup({ capacity: 3 });
      for (let i = 0; i < 5; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }
      sink.drain();

      // When
      sink.publishNow();

      // Then
      const [dropped] = samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.droppedRecords);
      expect(dropped).toMatchObject({
        value: 2,
        delta: 2,
        metricType: "counter",
        scope: "telemetry",
        labels: { realm: REALM },
      });
    });

    it("drains incrementally in order with maxRecords", () => {
      // Given
      const { sink } = setup();
      for (let i = 0; i < 5; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }

      // When
      const batches = [sink.drain(2), sink.drain(2), sink.drain(0), sink.drain(2), sink.drain()];

      // Then
      expect(batches.map((b) => b.records.map((r) => r.sequence))).toEqual([
        [0, 1],
        [2, 3],
        [],
        [4],
        [],
      ]);
      expect(sink.pendingCount()).toBe(0);
    });

    it("keeps working after the ring wraps around", () => {
      // Given
      const { sink } = setup({ capacity: 4 });
      for (let i = 0; i < 3; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }
      sink.drain(2);

      // When
      for (let i = 0; i < 3; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }

      // Then
      const batch = sink.drain();
      expect(batch.records.map((r) => r.sequence)).toEqual([2, 3, 4, 5]);
      expect(batch.dropped).toBe(0);
    });
  });

  describe("ingest", () => {
    it("appends foreign records unchanged without consuming own sequence numbers", () => {
      // Given
      const { sink } = setup();
      const foreign = TelemetryBuilder.batch({ realm: "worker:mcap-1" });

      // When
      sink.ingest(foreign);
      sink.event("app.ready", "instant", "app");

      // Then
      const { records } = sink.drain();
      expect(records.slice(0, foreign.records.length)).toEqual(foreign.records);
      expect(records[foreign.records.length]).toMatchObject({ realm: REALM, sequence: 0 });
    });

    it("forwards ingested events to onEvent", () => {
      // Given
      const onEvent = jest.fn();
      const { sink } = setup({ onEvent });
      const event = TelemetryBuilder.event();

      // When
      sink.ingest(TelemetryBuilder.batch({ records: [TelemetryBuilder.sample(), event] }));

      // Then
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
    });

    it("should keep ingesting and forwarding later events when onEvent throws", () => {
      // Given
      const onEvent = jest.fn(() => {
        throw new Error("observer failed");
      });
      const { sink } = setup({ onEvent });
      const events = [TelemetryBuilder.event(), TelemetryBuilder.event()];

      // When
      sink.ingest(TelemetryBuilder.batch({ records: events }));

      // Then
      expect(onEvent).toHaveBeenCalledTimes(2);
      expect(eventsOf(sink.drain().records)).toEqual(events);
      expect(console.warn).toHaveBeenCalledTimes(1);
      (console.warn as jest.Mock).mockClear();
    });

    it("accumulates foreign drops into drain().dropped and the droppedRecords self counter", () => {
      // Given
      const { sink } = setup();
      const realm = "worker:mcap-1";
      const foreignDropped = BasicBuilder.number({ min: 1, max: 100 });

      // When
      sink.ingest(TelemetryBuilder.batch({ realm, records: [], dropped: foreignDropped }));
      const afterIngest = sink.drain();
      sink.publishNow();

      // Then
      expect(afterIngest.dropped).toBe(foreignDropped);
      const [dropped] = samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.droppedRecords);
      expect(dropped).toMatchObject({ value: foreignDropped, labels: { realm } });
    });

    it("should reject foreign drops that would overflow the droppedRecords total to Infinity", () => {
      // Given
      const { sink } = setup();
      const realm = "worker:mcap-1";
      sink.ingest(TelemetryBuilder.batch({ realm, records: [], dropped: Number.MAX_VALUE }));

      // When
      sink.ingest(TelemetryBuilder.batch({ realm, records: [], dropped: Number.MAX_VALUE }));
      sink.publishNow();

      // Then
      const batch = sink.drain();
      const [dropped] = samplesOf(batch.records, TELEMETRY_SELF_METRICS.droppedRecords);
      expect(dropped).toMatchObject({ value: Number.MAX_VALUE, labels: { realm } });
      expect(rejectedCount(batch, "invalidValue")).toBe(1);
    });

    it("respects the ring bound", () => {
      // Given
      const { sink } = setup({ capacity: 2 });
      const records = [
        TelemetryBuilder.event({ sequence: 0 }),
        TelemetryBuilder.event({ sequence: 1 }),
        TelemetryBuilder.event({ sequence: 2 }),
      ];

      // When
      sink.ingest(TelemetryBuilder.batch({ records }));

      // Then
      const batch = sink.drain();
      expect(batch.records).toEqual(records.slice(1));
      expect(batch.dropped).toBe(1);
    });

    it("rejects an invalid foreign drop count", () => {
      // Given
      const { sink } = setup();

      // When
      sink.ingest(TelemetryBuilder.batch({ records: [], dropped: -1 }));
      const afterIngest = sink.drain();
      sink.publishNow();

      // Then
      expect(afterIngest.dropped).toBe(0);
      expect(rejectedCount(sink.drain(), "invalidValue")).toBe(1);
    });

    it("should reject ingested records with a disallowed label key like a direct call", () => {
      // Given
      const onEvent = jest.fn();
      const { sink } = setup({ onEvent });
      const realm = TelemetryBuilder.realm();
      const labels = { topic: "/camera" };
      const sample = TelemetryBuilder.sample({ realm, sequence: 0, labels });
      const event = TelemetryBuilder.event({ realm, sequence: 1, labels });

      // When
      sink.ingest(TelemetryBuilder.batch({ realm, records: [sample, event] }));
      const afterIngest = sink.drain();
      sink.gauge(sample.metric, 1, "bytes", "renderer", labels);
      sink.event(event.name, "instant", "app", labels);
      sink.publishNow();

      // Then
      expect(afterIngest.records).toEqual([]);
      expect(afterIngest.dropped).toBe(0);
      expect(onEvent).not.toHaveBeenCalled();
      const batch = sink.drain();
      expect(samplesOf(batch.records, sample.metric)).toHaveLength(0);
      expect(eventsOf(batch.records)).toHaveLength(0);
      expect(rejectedCount(batch, "unknownLabel")).toBe(4);
    });

    it("should bound ingested label sets by the per-metric cardinality cap", () => {
      // Given
      const maxSeriesPerMetric = 3;
      const { sink } = setup({ maxSeriesPerMetric });
      const realm = TelemetryBuilder.realm();
      const metric = TelemetryBuilder.metric();
      const attempts = 20;
      const records = Array.from({ length: attempts }, (_, i) =>
        TelemetryBuilder.sample({ realm, metric, sequence: i, labels: { sourceId: `s${i}` } }),
      );
      const events = Array.from({ length: attempts }, (_, i) =>
        TelemetryBuilder.event({
          realm,
          name: "datasource.open",
          sequence: attempts + i,
          labels: { sourceId: `s${i}` },
        }),
      );

      // When
      sink.ingest(TelemetryBuilder.batch({ realm, records: [...records, ...events] }));
      sink.ingest(TelemetryBuilder.batch({ realm, records: [records[0]!, events[0]!] }));
      const afterIngest = sink.drain();
      sink.publishNow();

      // Then
      expect(afterIngest.records).toEqual([
        ...records.slice(0, maxSeriesPerMetric),
        ...events.slice(0, maxSeriesPerMetric),
        records[0],
        events[0],
      ]);
      expect(rejectedCount(sink.drain(), "cardinality")).toBe(2 * (attempts - maxSeriesPerMetric));
    });

    it("should share the cardinality cap between direct and ingested series of a metric", () => {
      // Given
      const { sink } = setup({ maxSeriesPerMetric: 1 });
      const metric = TelemetryBuilder.metric();
      sink.gauge(metric, 1, "bytes", "renderer", { sourceId: "own" });
      const foreign = TelemetryBuilder.sample({ metric, labels: { sourceId: "foreign" } });

      // When
      sink.ingest(TelemetryBuilder.batch({ records: [foreign] }));
      sink.publishNow();

      // Then
      const batch = sink.drain();
      expect(samplesOf(batch.records, metric).map((s) => s.labels)).toEqual([{ sourceId: "own" }]);
      expect(rejectedCount(batch, "cardinality")).toBe(1);
    });

    it("should keep valid ingested records unchanged and not count rejections", () => {
      // Given
      const onEvent = jest.fn();
      const { sink } = setup({ onEvent });
      const realm = TelemetryBuilder.realm();
      const sample = TelemetryBuilder.sample({ realm, sequence: 0, labels: { sourceId: "a" } });
      const event = TelemetryBuilder.event({
        realm,
        sequence: 1,
        labels: { panelId: "Plot!a", panelType: "Plot" },
      });
      const unlabeled = TelemetryBuilder.sample({ realm, sequence: 2 });
      const records = [sample, event, unlabeled];

      // When
      sink.ingest(TelemetryBuilder.batch({ realm, records }));
      const afterIngest = sink.drain();
      sink.publishNow();

      // Then
      expect(afterIngest.records).toEqual(records);
      expect(afterIngest.records[0]).toBe(sample);
      expect(afterIngest.records[1]).toBe(event);
      expect(onEvent).toHaveBeenCalledWith(event);
      expect(samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.rejectedRecords)).toEqual([]);
    });
  });

  describe("label guard", () => {
    it("rejects records with unknown label keys and counts them", () => {
      // Given
      const onEvent = jest.fn();
      const { sink } = setup({ onEvent });
      const metric = TelemetryBuilder.metric();
      const labels = { topic: "/camera" };

      // When
      sink.gauge(metric, 1, "bytes", "renderer", labels);
      sink.counter(metric, 1, "count", "renderer", labels);
      sink.event("app.ready", "instant", "app", labels);
      sink.publishNow();

      // Then
      const batch = sink.drain();
      expect(samplesOf(batch.records, metric)).toHaveLength(0);
      expect(eventsOf(batch.records)).toHaveLength(0);
      expect(onEvent).not.toHaveBeenCalled();
      expect(rejectedCount(batch, "unknownLabel")).toBe(3);
    });

    it("caps the number of label sets per metric (no unbounded cardinality)", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      for (let i = 0; i < DEFAULT_MAX_SERIES_PER_METRIC; i++) {
        sink.gauge(metric, i, "bytes", "worker", { sourceId: `s${i}` });
      }

      // When
      sink.gauge(metric, 999, "bytes", "worker", { sourceId: "overflow" });
      sink.gauge(metric, 42, "bytes", "worker", { sourceId: "s0" });
      sink.publishNow();

      // Then
      const batch = sink.drain();
      const samples = samplesOf(batch.records, metric);
      expect(samples).toHaveLength(DEFAULT_MAX_SERIES_PER_METRIC);
      expect(samples.find((s) => s.labels?.sourceId === "overflow")).toBeUndefined();
      expect(samples.find((s) => s.labels?.sourceId === "s0")?.value).toBe(42);
      expect(rejectedCount(batch, "cardinality")).toBe(1);
    });

    it("caps the number of label sets per event name", () => {
      // Given
      const { sink } = setup({ maxSeriesPerMetric: 2 });
      sink.event("datasource.open", "start", "pipeline", { sourceId: "a" });
      sink.event("datasource.open", "start", "pipeline", { sourceId: "b" });

      // When
      sink.event("datasource.open", "start", "pipeline", { sourceId: "c" });
      sink.event("datasource.open", "end", "pipeline", { sourceId: "a" });
      sink.publishNow();

      // Then
      const batch = sink.drain();
      expect(eventsOf(batch.records).map((e) => e.labels?.sourceId)).toEqual(["a", "b", "a"]);
      expect(rejectedCount(batch, "cardinality")).toBe(1);
    });
  });

  describe("reserved self-metric names", () => {
    it.each(
      Object.values(TELEMETRY_SELF_METRICS),
    )("should reject caller gauge, counter and observe calls named %s", (metric) => {
      // Given
      const { sink } = setup();

      // When
      sink.gauge(metric, 1, "count", "app");
      sink.counter(metric, 1, "count", "app");
      sink.observe(metric, 1, "count", "app");
      sink.publishNow();

      // Then
      expect(rejectedCount(sink.drain(), "reservedName")).toBe(3);
    });

    it("should not let a caller counter write into the sink's rejectedRecords series", () => {
      // Given: an existing rejectedRecords{reason="invalidValue"} self series
      const { sink } = setup();
      sink.gauge(TelemetryBuilder.metric(), Number.NaN, "count", "app");

      // When: a caller records the same metric name and labels
      sink.counter(TELEMETRY_SELF_METRICS.rejectedRecords, 100, "count", "telemetry", {
        reason: "invalidValue",
      });
      sink.publishNow();

      // Then: the self series only counts the sink's own rejections
      const batch = sink.drain();
      expect(rejectedCount(batch, "invalidValue")).toBe(1);
      expect(rejectedCount(batch, "reservedName")).toBe(1);
    });

    it("should not let a caller gauge overwrite the seriesCount self gauge", () => {
      // Given: the seriesCount gauge exists after a first publish
      const { sink } = setup();
      sink.publishNow();
      sink.drain();

      // When
      sink.gauge(TELEMETRY_SELF_METRICS.seriesCount, 1000, "count", "telemetry");
      sink.publishNow();

      // Then: 1 seriesCount gauge + 1 rejectedRecords{reservedName} counter
      const seriesCounts = samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.seriesCount);
      expect(seriesCounts.map((sample) => sample.value)).toEqual([2]);
    });

    it("should accept other telemetry.* names from callers", () => {
      // Given
      const { sink } = setup();
      const metric = "telemetry.self.timeMs.frames";

      // When
      sink.counter(metric, 1.5, "ms", "telemetry");
      sink.publishNow();

      // Then
      const batch = sink.drain();
      expect(samplesOf(batch.records, metric)).toEqual([
        expect.objectContaining({ value: 1.5, metricType: "counter" }),
      ]);
      expect(rejectedCount(batch, "reservedName")).toBeUndefined();
    });

    it("should still forward ingested self-metric records of another realm", () => {
      // Given
      const { sink } = setup();
      const record = TelemetryBuilder.sample({
        realm: "worker:1",
        metric: TELEMETRY_SELF_METRICS.rejectedRecords,
        labels: { reason: "cardinality" },
      });

      // When
      sink.ingest(TelemetryBuilder.batch({ realm: "worker:1", records: [record] }));

      // Then
      expect(sink.drain().records).toEqual([record]);
    });
  });

  describe("timer", () => {
    it("starts the publish timer once and publishes on each tick", () => {
      // Given
      const { sink, setIntervalMock } = setup({ publishIntervalMs: 500 });
      const metric = TelemetryBuilder.metric();
      sink.gauge(metric, 7, "percent", "process");

      // When
      sink.start();
      sink.start();
      const tick = setIntervalMock.mock.calls[0]?.[0];
      tick?.();
      tick?.();

      // Then
      expect(setIntervalMock).toHaveBeenCalledTimes(1);
      expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 500);
      expect(samplesOf(sink.drain().records, metric)).toHaveLength(2);
    });

    it("does not leak timers with the default timer functions", () => {
      // Given
      jest.useFakeTimers();
      try {
        const sink = new BufferedTelemetrySink({ realm: REALM, now: () => 0 });
        const metric = TelemetryBuilder.metric();
        sink.gauge(metric, 1, "bytes", "renderer");
        sink.start();
        jest.advanceTimersByTime(3000);

        // When
        sink.dispose();

        // Then
        expect(jest.getTimerCount()).toBe(0);
        // 3 timer publishes + the final publish on dispose
        expect(samplesOf(sink.drain().records, metric)).toHaveLength(4);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("dispose", () => {
    it("performs a final publish, clears the timer and keeps records drainable", () => {
      // Given
      const { sink, timerHandle, clearIntervalMock } = setup();
      const metric = TelemetryBuilder.metric();
      sink.start();
      sink.counter(metric, 3, "count", "pipeline");

      // When
      sink.dispose();

      // Then
      expect(sink.isEnabled()).toBe(false);
      expect(clearIntervalMock).toHaveBeenCalledTimes(1);
      expect(clearIntervalMock).toHaveBeenCalledWith(timerHandle);
      expect(samplesOf(sink.drain().records, metric)).toEqual([
        expect.objectContaining({ value: 3, delta: 3 }),
      ]);
    });

    it("turns every recording method into a no-op afterwards and is idempotent", () => {
      // Given
      const onEvent = jest.fn();
      const { sink, setIntervalMock, clearIntervalMock } = setup({ onEvent });
      sink.dispose();
      sink.drain();

      // When
      sink.gauge(TelemetryBuilder.metric(), 1, "bytes", "renderer");
      sink.counter(TelemetryBuilder.metric(), 1, "count", "renderer");
      sink.event("datasource.close", "end", "pipeline");
      sink.ingest(TelemetryBuilder.batch({ dropped: 5 }));
      sink.start();
      sink.publishNow();
      sink.dispose();

      // Then
      expect(sink.drain()).toEqual({ realm: REALM, records: [], dropped: 0 });
      expect(onEvent).not.toHaveBeenCalled();
      expect(setIntervalMock).not.toHaveBeenCalled();
      expect(clearIntervalMock).not.toHaveBeenCalled();
    });
  });

  describe("accounting", () => {
    it("should publish counter deltas that sum to the cumulative value when published many times", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      const increments = BasicBuilder.multiple(() => BasicBuilder.number({ min: 0, max: 50 }), 25);
      let expectedTotal = 0;

      // When
      for (const increment of increments) {
        sink.counter(metric, increment, "count", "pipeline");
        expectedTotal += increment;
        sink.publishNow();
      }

      // Then
      const samples = samplesOf(sink.drain().records, metric);
      let deltaSum = 0;
      let previousValue = 0;
      for (const sample of samples) {
        expect(sample.delta).toBeGreaterThanOrEqual(0);
        expect(sample.value).toBeGreaterThanOrEqual(previousValue);
        expect(sample.value).toBe(previousValue + sample.delta!);
        deltaSum += sample.delta!;
        previousValue = sample.value;
      }
      expect(deltaSum).toBe(expectedTotal);
      expect(samples.at(-1)?.value).toBe(expectedTotal);
    });

    it("should account every produced record as either drained or dropped when drained under overflow", () => {
      // Given
      const capacity = 7;
      const { sink } = setup({ capacity });
      const produced = 50;

      // When
      const batches: TelemetryBatch[] = [];
      for (let i = 0; i < produced; i++) {
        sink.event("seek.requested", "instant", "pipeline");
        if (i % 11 === 0) {
          batches.push(sink.drain(3));
        }
      }
      batches.push(sink.drain());

      // Then
      let drained = 0;
      let reportedDropped = 0;
      for (const batch of batches) {
        expect(batch.dropped).toBeGreaterThanOrEqual(0);
        drained += batch.records.length;
        reportedDropped += batch.dropped;
      }
      expect(reportedDropped).toBeGreaterThan(0);
      expect(drained + reportedDropped).toBe(produced);
    });

    it("should add up the drops of repeated foreign batches from one realm in a single droppedRecords series", () => {
      // Given
      const { sink } = setup();
      const realm = TelemetryBuilder.realm();
      const drops = [3, 4, 5];

      // When
      for (const dropped of drops) {
        sink.ingest(TelemetryBuilder.batch({ realm, records: [], dropped }));
      }
      const afterIngest = sink.drain();
      sink.publishNow();

      // Then
      const droppedSeries = samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.droppedRecords);
      expect(afterIngest.dropped).toBe(12);
      expect(droppedSeries).toEqual([
        expect.objectContaining({ value: 12, delta: 12, labels: { realm } }),
      ]);
    });

    it("should merge own overflow drops into the droppedRecords series an ingested batch created for the own realm", () => {
      // Given
      const { sink } = setup({ capacity: 2 });
      sink.ingest(TelemetryBuilder.batch({ realm: REALM, records: [], dropped: 2 }));

      // When
      sink.event("app.ready", "instant", "app");
      sink.event("app.ready", "instant", "app");
      sink.event("app.ready", "instant", "app");
      const afterOverflow = sink.drain();
      sink.publishNow();

      // Then
      const droppedSeries = samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.droppedRecords);
      expect(afterOverflow.dropped).toBe(3);
      expect(droppedSeries).toEqual([
        expect.objectContaining({ value: 3, labels: { realm: REALM } }),
      ]);
    });
  });

  describe("ids", () => {
    it("should reveal every overflow drop as a sequence gap of the own realm", () => {
      // Given
      const capacity = 5;
      const { sink } = setup({ capacity });
      const produced = 23;
      for (let i = 0; i < produced; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }

      // When
      const batch = sink.drain();

      // Then: the surviving records are the newest, contiguous and all stamped with the own realm.
      const sequences = batch.records.map((record) => record.sequence);
      expect(sequences).toEqual([18, 19, 20, 21, 22]);
      expect(batch.records.every((record) => record.realm === REALM)).toBe(true);
      // Missing sequences (0..17) are exactly the reported drops.
      expect(sequences[0]).toBe(batch.dropped);
    });

    it("should keep own sequences contiguous across drains and interleaved foreign ingests", () => {
      // Given
      const { sink } = setup();
      const foreignRealm = TelemetryBuilder.realm();

      // When
      const own: number[] = [];
      for (let round = 0; round < 4; round++) {
        sink.event("seek.requested", "instant", "pipeline");
        sink.ingest(TelemetryBuilder.batch({ realm: foreignRealm }));
        sink.gauge(TelemetryBuilder.metric(), round, "count", "pipeline");
        sink.publishNow();
        for (const record of sink.drain(2).records.concat(sink.drain().records)) {
          if (record.realm === REALM) {
            own.push(record.sequence);
          }
        }
      }

      // Then
      expect(own.length).toBeGreaterThan(0);
      expect(own).toEqual(own.map((_, i) => i));
    });

    it("should keep foreign realm and sequence untouched when ingested", () => {
      // Given
      const { sink } = setup();
      const realmA = "worker:1";
      const realmB = "worker:2";
      const batchA = TelemetryBuilder.batch({ realm: realmA });
      const batchB = TelemetryBuilder.batch({ realm: realmB });

      // When
      sink.ingest(batchA);
      sink.ingest(batchB);

      // Then
      const records = sink.drain().records;
      expect(records.filter((r) => r.realm === realmA).map((r) => r.sequence)).toEqual([0, 1]);
      expect(records.filter((r) => r.realm === realmB).map((r) => r.sequence)).toEqual([0, 1]);
      expect(records.some((r) => r.realm === REALM)).toBe(false);
    });
  });

  describe("bounded flush", () => {
    it("should never buffer more than capacity when 10x capacity records are produced", () => {
      // Given
      const capacity = 16;
      const { sink } = setup({ capacity });
      const metric = TelemetryBuilder.metric();
      let maxPending = 0;

      // When: events and publishes (which also grow the self-metric series) at 10x capacity
      for (let i = 0; i < capacity * 10; i++) {
        sink.event("seek.requested", "instant", "pipeline");
        sink.counter(metric, 1, "count", "pipeline");
        if (i % 4 === 0) {
          sink.publishNow();
        }
        maxPending = Math.max(maxPending, sink.pendingCount());
      }
      const batch = sink.drain();

      // Then
      expect(maxPending).toBe(capacity);
      expect(batch.records).toHaveLength(capacity);
      expect(batch.dropped).toBeGreaterThanOrEqual(capacity * 9);
      expect(sink.pendingCount()).toBe(0);
    });

    it("should report the overflow drop count only with the first incremental drain", () => {
      // Given
      const capacity = 6;
      const { sink } = setup({ capacity });
      for (let i = 0; i < capacity * 10; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }

      // When
      const batches: TelemetryBatch[] = [];
      while (sink.pendingCount() > 0) {
        batches.push(sink.drain(4));
      }
      batches.push(sink.drain(4));

      // Then
      expect(batches.map((batch) => batch.records.length)).toEqual([4, 2, 0]);
      expect(batches.map((batch) => batch.dropped)).toEqual([capacity * 9, 0, 0]);
      expect(batches.flatMap((batch) => batch.records.map((r) => r.sequence))).toEqual([
        54, 55, 56, 57, 58, 59,
      ]);
    });

    it("should account drops that happen between incremental drains in the next drain only", () => {
      // Given
      const { sink } = setup({ capacity: 3 });
      for (let i = 0; i < 5; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }
      const first = sink.drain(1);

      // When: 2 buffered + 4 new = 6 records for 3 slots → 3 more drops
      for (let i = 0; i < 4; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }
      const second = sink.drain(1);
      const rest = sink.drain();

      // Then
      expect(first.dropped).toBe(2);
      expect(second.dropped).toBe(3);
      expect(rest.dropped).toBe(0);
      expect([...second.records, ...rest.records].map((r) => r.sequence)).toEqual([6, 7, 8]);
    });

    it("should treat negative and fractional maxRecords as bounded drains", () => {
      // Given
      const { sink } = setup();
      for (let i = 0; i < 3; i++) {
        sink.event("seek.requested", "instant", "pipeline");
      }

      // When
      const negative = sink.drain(-5);
      const fractional = sink.drain(1.9);

      // Then
      expect(negative.records).toHaveLength(0);
      expect(fractional.records).toHaveLength(1);
      expect(sink.pendingCount()).toBe(2);
    });
  });

  describe("bounded cardinality", () => {
    it("should keep at most one rejectedRecords series per reason under many rejections", () => {
      // Given
      const { sink } = setup({ maxSeriesPerMetric: 2 });
      const metric = TelemetryBuilder.metric();
      const rejections = 200;

      // When
      for (let i = 0; i < rejections; i++) {
        sink.gauge(metric, 1, "count", "pipeline", { sourceId: `s${i}` });
        sink.counter(TelemetryBuilder.metric(), 1, "count", "pipeline", { [`key${i}`]: "x" });
        sink.counter(metric, -i - 1, "count", "pipeline");
      }
      sink.publishNow();

      // Then
      const batch = sink.drain();
      const rejected = samplesOf(batch.records, TELEMETRY_SELF_METRICS.rejectedRecords);
      expect(rejected.map((sample) => sample.labels?.reason).sort()).toEqual([
        "cardinality",
        "invalidValue",
        "unknownLabel",
      ]);
      expect(rejectedCount(batch, "cardinality")).toBe(rejections - 2);
      expect(rejectedCount(batch, "unknownLabel")).toBe(rejections);
      expect(rejectedCount(batch, "invalidValue")).toBe(rejections);
    });

    it("should keep the seriesCount gauge stable once the per-metric cap is reached", () => {
      // Given
      const maxSeriesPerMetric = 4;
      const { sink } = setup({ maxSeriesPerMetric });
      const metric = TelemetryBuilder.metric();
      const seriesCounts: number[] = [];

      // When: 10 publish rounds, each trying 20 new label sets
      for (let round = 0; round < 10; round++) {
        for (let i = 0; i < 20; i++) {
          sink.gauge(metric, i, "count", "pipeline", { sourceId: `r${round}-s${i}` });
        }
        sink.publishNow();
        const [seriesCount] = samplesOf(sink.drain().records, TELEMETRY_SELF_METRICS.seriesCount);
        seriesCounts.push(seriesCount!.value);
      }

      // Then: capped gauge series + seriesCount gauge + rejectedRecords{cardinality}
      expect(new Set(seriesCounts)).toEqual(new Set([maxSeriesPerMetric + 2]));
    });

    it("should not let unknown label keys consume a series slot of the metric", () => {
      // Given
      const { sink } = setup({ maxSeriesPerMetric: 1 });
      const metric = TelemetryBuilder.metric();

      // When
      for (let i = 0; i < 10; i++) {
        sink.gauge(metric, 1, "count", "pipeline", { topic: `/t${i}` });
      }
      sink.gauge(metric, 2, "count", "pipeline", { sourceId: "a" });
      sink.publishNow();

      // Then
      const batch = sink.drain();
      expect(samplesOf(batch.records, metric).map((s) => s.labels)).toEqual([{ sourceId: "a" }]);
      expect(rejectedCount(batch, "unknownLabel")).toBe(10);
      expect(rejectedCount(batch, "cardinality")).toBeUndefined();
    });

    it("should cap the per-realm droppedRecords series created by foreign batches", () => {
      // Given
      const maxSeriesPerMetric = 3;
      const { sink } = setup({ maxSeriesPerMetric });
      const realms = BasicBuilder.multiple(() => TelemetryBuilder.realm(), 10);

      // When
      for (const realm of realms) {
        sink.ingest(TelemetryBuilder.batch({ realm, records: [], dropped: 2 }));
      }
      const afterIngest = sink.drain();
      sink.publishNow();

      // Then: every foreign drop is still accounted, but only the first realms get a series
      const batch = sink.drain();
      expect(afterIngest.dropped).toBe(realms.length * 2);
      const droppedSeries = samplesOf(batch.records, TELEMETRY_SELF_METRICS.droppedRecords);
      expect(droppedSeries.map((sample) => sample.labels?.realm)).toEqual(
        realms.slice(0, maxSeriesPerMetric),
      );
      expect(rejectedCount(batch, "cardinality")).toBe(realms.length - maxSeriesPerMetric);
    });

    it("should cap observe label sets at the default per-metric limit while admitted series keep aggregating", () => {
      // Given
      const { sink } = setup();
      const metric = TelemetryBuilder.metric();
      for (let i = 0; i < DEFAULT_MAX_SERIES_PER_METRIC; i++) {
        sink.observe(metric, 1, "ms", "panel", { panelId: `Plot!${i}` });
      }

      // When
      sink.observe(metric, 5, "ms", "panel", { panelId: "Plot!overflow" });
      sink.observe(metric, 9, "ms", "panel", { panelId: "Plot!0" });
      sink.publishNow();

      // Then
      const batch = sink.drain();
      const counts = samplesOf(batch.records, `${metric}.count`);
      expect(counts).toHaveLength(DEFAULT_MAX_SERIES_PER_METRIC);
      expect(counts.find((s) => s.labels?.panelId === "Plot!overflow")).toBeUndefined();
      const maxOfFirst = samplesOf(batch.records, `${metric}.max`).find(
        (s) => s.labels?.panelId === "Plot!0",
      );
      expect(maxOfFirst?.value).toBe(9);
      expect(rejectedCount(batch, "cardinality")).toBe(1);
    });

    it("should cap event label sets independently per event name", () => {
      // Given
      const { sink } = setup({ maxSeriesPerMetric: 1 });

      // When
      sink.event("datasource.open", "start", "pipeline", { sourceId: "a" });
      sink.event("datasource.close", "start", "pipeline", { sourceId: "b" });
      sink.event("datasource.open", "start", "pipeline", { sourceId: "c" });
      sink.publishNow();

      // Then
      const batch = sink.drain();
      expect(eventsOf(batch.records).map((e) => [e.name, e.labels?.sourceId])).toEqual([
        ["datasource.open", "a"],
        ["datasource.close", "b"],
      ]);
      expect(rejectedCount(batch, "cardinality")).toBe(1);
    });
  });

  describe("cleanup", () => {
    it("should leave no pending timers after dispose even when start() was called repeatedly", () => {
      // Given
      jest.useFakeTimers();
      try {
        const sink = new BufferedTelemetrySink({ realm: REALM, now: () => 0 });
        sink.start();
        sink.start();
        sink.start();

        // When
        sink.dispose();
        sink.start();

        // Then
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
