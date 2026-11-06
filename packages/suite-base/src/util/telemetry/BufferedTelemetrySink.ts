// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CounterSeries, GaugeSeries, ObservationSeries } from "./BufferedTelemetrySink.types";
import { monotonicNow } from "./clock";
import {
  DEFAULT_MAX_SERIES_PER_METRIC,
  DEFAULT_TELEMETRY_CAPACITY,
  DEFAULT_TELEMETRY_PUBLISH_INTERVAL_MS,
  RESERVED_TELEMETRY_METRIC_NAMES,
  TELEMETRY_SELF_METRICS,
} from "./constants";
import { buildSeriesKey, TelemetryLabelGuard } from "./labels";
import {
  BufferedTelemetrySinkOptions,
  ITelemetry,
  TelemetryBatch,
  TelemetryEvent,
  TelemetryEventName,
  TelemetryLabels,
  TelemetryPhase,
  TelemetryRecord,
  TelemetryRejectReason,
  TelemetrySample,
  TelemetryScope,
  TelemetryUnit,
} from "./types";

function copyLabels(labels: TelemetryLabels | undefined): TelemetryLabels | undefined {
  if (labels == undefined || Object.keys(labels).length === 0) {
    return undefined;
  }
  return Object.freeze({ ...labels });
}

function defaultSetInterval(handler: () => void, intervalMs: number): unknown {
  return globalThis.setInterval(handler, intervalMs);
}

function defaultClearInterval(handle: unknown): void {
  globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>);
}

/**
 * In-memory telemetry sink for one JS realm.
 *
 * - Gauges (last value wins) and counters (cumulative) are aggregated per series and published as
 *   samples every `publishIntervalMs` once `start()` is called (or on `publishNow()`).
 * - Events are recorded immediately.
 * - Records are stored in a bounded ring buffer; on overflow the oldest record is dropped and
 *   counted. Consumers pull records incrementally with `drain()`.
 * - Every own record gets `realm` and a per-sink `sequence` (starting at 0) assigned at push time,
 *   so sequence gaps reveal drops. Ingested foreign records keep their realm/sequence/timestamp.
 *
 * Counter publishing: every counter series is published at its first publish. Afterwards, series
 * whose delta since the previous publish is 0 are skipped to limit volume; the cumulative `value`
 * of the next published sample still covers the whole history.
 *
 * Observation publishing (`observe()`): each series aggregates count / sum / max per publish
 * window. A window with at least one observation publishes `${metric}.count` and `${metric}.sum`
 * as counters (cumulative `value`, `delta` = window total) and `${metric}.max` as a gauge (max of
 * the window); then the window is reset. Empty windows publish nothing.
 *
 * Series keep the unit/scope they were created with.
 *
 * Self-metrics (`TELEMETRY_SELF_METRICS`) live in their own series, separate from caller series;
 * their names are reserved, so caller calls using them are rejected (reason "reservedName").
 */
export class BufferedTelemetrySink implements ITelemetry {
  readonly #realm: string;
  readonly #capacity: number;
  readonly #publishIntervalMs: number;
  readonly #now: () => number;
  readonly #setInterval: (handler: () => void, intervalMs: number) => unknown;
  readonly #clearInterval: (handle: unknown) => void;
  readonly #onEvent: ((event: TelemetryEvent) => void) | undefined;

  // Ring buffer: fixed-size array, `#head` = index of the oldest record.
  readonly #ring: Array<TelemetryRecord | undefined>;
  #head = 0;
  #size = 0;
  /** Dropped records (own overflow + foreign batch drops) since the previous drain. */
  #dropped = 0;
  #sequence = 0;

  #enabled = true;
  #timerHandle: unknown = undefined;
  #timerActive = false;

  readonly #gauges = new Map<string, GaugeSeries>();
  readonly #counters = new Map<string, CounterSeries>();
  // The sink's own series, kept apart from caller series so callers can never write into them.
  readonly #selfCounters = new Map<string, CounterSeries>();
  #seriesCountSeries: GaugeSeries | undefined;
  readonly #observations = new Map<string, ObservationSeries>();
  readonly #metricGuard: TelemetryLabelGuard;
  readonly #eventGuard: TelemetryLabelGuard;

  readonly #ownRealmLabels: TelemetryLabels;
  #ownDroppedSeries: CounterSeries | undefined;
  readonly #rejectedSeries = new Map<TelemetryRejectReason, CounterSeries>();

  readonly #publishTick = (): void => {
    this.publishNow();
  };

  public constructor(options: BufferedTelemetrySinkOptions) {
    const capacity = options.capacity ?? DEFAULT_TELEMETRY_CAPACITY;
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(`capacity must be a positive integer, got ${capacity}`);
    }
    const publishIntervalMs = options.publishIntervalMs ?? DEFAULT_TELEMETRY_PUBLISH_INTERVAL_MS;
    if (!Number.isFinite(publishIntervalMs) || publishIntervalMs <= 0) {
      throw new Error(`publishIntervalMs must be a positive number, got ${publishIntervalMs}`);
    }
    const maxSeriesPerMetric = options.maxSeriesPerMetric ?? DEFAULT_MAX_SERIES_PER_METRIC;

    this.#realm = options.realm;
    this.#capacity = capacity;
    this.#publishIntervalMs = publishIntervalMs;
    this.#now = options.now ?? monotonicNow;
    this.#setInterval = options.setInterval ?? defaultSetInterval;
    this.#clearInterval = options.clearInterval ?? defaultClearInterval;
    this.#onEvent = options.onEvent;
    this.#ring = new Array<TelemetryRecord | undefined>(capacity);
    this.#metricGuard = new TelemetryLabelGuard(maxSeriesPerMetric);
    this.#eventGuard = new TelemetryLabelGuard(maxSeriesPerMetric);
    this.#ownRealmLabels = Object.freeze({ realm: options.realm });
  }

  public isEnabled(): boolean {
    return this.#enabled;
  }

  /** Starts the periodic publish timer. Idempotent; no-op after `dispose()`. */
  public start(): void {
    if (!this.#enabled || this.#timerActive) {
      return;
    }
    this.#timerHandle = this.#setInterval(this.#publishTick, this.#publishIntervalMs);
    this.#timerActive = true;
  }

  /**
   * Pushes one sample per gauge series (latest value), per counter series (cumulative value +
   * delta since the previous publish; unchanged counters are skipped after their first publish)
   * and three samples per observation series with a non-empty window (count / sum / max).
   * All samples of one publish share the same `monotonicTs`.
   */
  public publishNow(): void {
    if (!this.#enabled) {
      return;
    }
    const monotonicTs = this.#now();
    this.#updateSeriesCount();

    for (const series of this.#gauges.values()) {
      this.#publishGauge(series, monotonicTs);
    }
    if (this.#seriesCountSeries != undefined) {
      this.#publishGauge(this.#seriesCountSeries, monotonicTs);
    }

    for (const series of this.#counters.values()) {
      this.#publishCounter(series, monotonicTs);
    }
    for (const series of this.#selfCounters.values()) {
      this.#publishCounter(series, monotonicTs);
    }

    for (const series of this.#observations.values()) {
      if (series.windowCount === 0) {
        continue;
      }
      series.totalCount += series.windowCount;
      series.totalSum += series.windowSum;
      this.#pushObservationSample(
        series,
        series.countMetric,
        series.totalCount,
        "count",
        "counter",
        series.windowCount,
        monotonicTs,
      );
      this.#pushObservationSample(
        series,
        series.sumMetric,
        series.totalSum,
        series.unit,
        "counter",
        series.windowSum,
        monotonicTs,
      );
      this.#pushObservationSample(
        series,
        series.maxMetric,
        series.windowMax,
        series.unit,
        "gauge",
        undefined,
        monotonicTs,
      );
      series.windowCount = 0;
      series.windowSum = 0;
      series.windowMax = 0;
    }
  }

  public gauge(
    metric: string,
    value: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void {
    if (!this.#enabled) {
      return;
    }
    if (!Number.isFinite(value)) {
      this.#reject("invalidValue");
      return;
    }
    const key = buildSeriesKey(metric, labels);
    const series = this.#gauges.get(key);
    if (series != undefined) {
      series.value = value;
      return;
    }
    if (RESERVED_TELEMETRY_METRIC_NAMES.has(metric)) {
      this.#reject("reservedName");
      return;
    }
    const reason = this.#metricGuard.admit(metric, key, labels);
    if (reason != undefined) {
      this.#reject(reason);
      return;
    }
    this.#gauges.set(key, { metric, unit, scope, labels: copyLabels(labels), value });
  }

  public counter(
    metric: string,
    increment: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void {
    if (!this.#enabled) {
      return;
    }
    if (!Number.isFinite(increment) || increment < 0) {
      this.#reject("invalidValue");
      return;
    }
    const key = buildSeriesKey(metric, labels);
    const series = this.#counters.get(key);
    if (series != undefined) {
      const total = series.total + increment;
      if (!Number.isFinite(total)) {
        this.#reject("invalidValue");
        return;
      }
      series.total = total;
      return;
    }
    if (RESERVED_TELEMETRY_METRIC_NAMES.has(metric)) {
      this.#reject("reservedName");
      return;
    }
    const reason = this.#metricGuard.admit(metric, key, labels);
    if (reason != undefined) {
      this.#reject(reason);
      return;
    }
    this.#createCounter(this.#counters, key, metric, unit, scope, copyLabels(labels)).total +=
      increment;
  }

  public observe(
    metric: string,
    value: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void {
    if (!this.#enabled) {
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      this.#reject("invalidValue");
      return;
    }
    const key = buildSeriesKey(metric, labels);
    let series = this.#observations.get(key);
    if (series == undefined) {
      if (RESERVED_TELEMETRY_METRIC_NAMES.has(metric)) {
        this.#reject("reservedName");
        return;
      }
      const reason = this.#metricGuard.admit(metric, key, labels);
      if (reason != undefined) {
        this.#reject(reason);
        return;
      }
      series = {
        countMetric: `${metric}.count`,
        sumMetric: `${metric}.sum`,
        maxMetric: `${metric}.max`,
        unit,
        scope,
        labels: copyLabels(labels),
        windowCount: 0,
        windowSum: 0,
        windowMax: 0,
        totalCount: 0,
        totalSum: 0,
      };
      this.#observations.set(key, series);
    }
    series.windowCount++;
    series.windowSum += value;
    if (value > series.windowMax) {
      series.windowMax = value;
    }
  }

  public event(
    name: TelemetryEventName,
    phase: TelemetryPhase,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void {
    if (!this.#enabled) {
      return;
    }
    const reason = this.#eventGuard.admit(name, buildSeriesKey(name, labels), labels);
    if (reason != undefined) {
      this.#reject(reason);
      return;
    }
    const event: TelemetryEvent = {
      kind: "event",
      realm: this.#realm,
      sequence: this.#sequence++,
      monotonicTs: this.#now(),
      name,
      phase,
      scope,
    };
    const ownLabels = copyLabels(labels);
    if (ownLabels != undefined) {
      event.labels = ownLabels;
    }
    this.#push(event);
    this.#onEvent?.(event);
  }

  /**
   * Appends records produced by another realm as-is (subject to the ring bound) and accounts for
   * the records that realm dropped. Ingested events are also forwarded to `onEvent`.
   *
   * Every ingested record passes the same label guard as the direct API (key allow-list and
   * per-metric / per-event-name cardinality cap, shared with this sink's own series): rejected
   * records are discarded and counted in `telemetry.rejectedRecords{reason}`, exactly like a
   * rejected `gauge()` / `event()` call. They are not counted in `dropped`, so the foreign
   * realm's sequence numbers may show a gap for them.
   */
  public ingest(batch: TelemetryBatch): void {
    if (!this.#enabled) {
      return;
    }
    for (const record of batch.records) {
      const reason =
        record.kind === "event"
          ? this.#eventGuard.admit(
              record.name,
              buildSeriesKey(record.name, record.labels),
              record.labels,
            )
          : this.#metricGuard.admit(
              record.metric,
              buildSeriesKey(record.metric, record.labels),
              record.labels,
            );
      if (reason != undefined) {
        this.#reject(reason);
        continue;
      }
      this.#push(record);
      if (record.kind === "event") {
        this.#onEvent?.(record);
      }
    }
    if (batch.dropped === 0) {
      return;
    }
    if (!Number.isFinite(batch.dropped) || batch.dropped < 0) {
      this.#reject("invalidValue");
      return;
    }
    this.#dropped += batch.dropped;
    const labels: TelemetryLabels = { realm: batch.realm };
    const key = buildSeriesKey(TELEMETRY_SELF_METRICS.droppedRecords, labels);
    let series = this.#selfCounters.get(key);
    if (series == undefined) {
      const reason = this.#metricGuard.admit(TELEMETRY_SELF_METRICS.droppedRecords, key, labels);
      if (reason != undefined) {
        this.#reject(reason);
        return;
      }
      series = this.#createCounter(
        this.#selfCounters,
        key,
        TELEMETRY_SELF_METRICS.droppedRecords,
        "count",
        "telemetry",
        copyLabels(labels),
      );
    }
    const total = series.total + batch.dropped;
    if (!Number.isFinite(total)) {
      this.#reject("invalidValue");
      return;
    }
    series.total = total;
  }

  /**
   * Removes and returns up to `maxRecords` of the oldest buffered records (in order), plus the
   * number of records dropped since the previous drain (which is then reset).
   * Still usable after `dispose()` to collect the remaining records.
   */
  public drain(maxRecords: number = this.#capacity): TelemetryBatch {
    const limit = maxRecords > 0 ? Math.floor(maxRecords) : 0;
    const count = Math.min(this.#size, limit);
    const records: TelemetryRecord[] = [];
    for (let i = 0; i < count; i++) {
      const index = (this.#head + i) % this.#capacity;
      const record = this.#ring[index];
      if (record != undefined) {
        records.push(record);
      }
      this.#ring[index] = undefined;
    }
    this.#head = (this.#head + count) % this.#capacity;
    this.#size -= count;
    const dropped = this.#dropped;
    this.#dropped = 0;
    return { realm: this.#realm, records, dropped };
  }

  /** Number of records currently buffered (not yet drained). */
  public pendingCount(): number {
    return this.#size;
  }

  /**
   * Performs a final publish, stops the timer and disables the sink: afterwards `isEnabled()` is
   * false and all recording methods are no-ops. Buffered records can still be drained.
   * Series state is released. Idempotent.
   */
  public dispose(): void {
    if (!this.#enabled) {
      return;
    }
    this.publishNow();
    if (this.#timerActive) {
      this.#clearInterval(this.#timerHandle);
      this.#timerHandle = undefined;
      this.#timerActive = false;
    }
    this.#enabled = false;
    this.#clearSeries();
  }

  #clearSeries(): void {
    this.#gauges.clear();
    this.#counters.clear();
    this.#selfCounters.clear();
    this.#seriesCountSeries = undefined;
    this.#observations.clear();
    this.#metricGuard.clear();
    this.#eventGuard.clear();
    this.#rejectedSeries.clear();
    this.#ownDroppedSeries = undefined;
  }

  #push(record: TelemetryRecord): void {
    const capacity = this.#capacity;
    if (this.#size < capacity) {
      this.#ring[(this.#head + this.#size) % capacity] = record;
      this.#size++;
      return;
    }
    // Full: overwrite the oldest record.
    this.#ring[this.#head] = record;
    this.#head = (this.#head + 1) % capacity;
    this.#dropped++;
    this.#ownDroppedSeries ??= this.#createCounter(
      this.#selfCounters,
      buildSeriesKey(TELEMETRY_SELF_METRICS.droppedRecords, this.#ownRealmLabels),
      TELEMETRY_SELF_METRICS.droppedRecords,
      "count",
      "telemetry",
      this.#ownRealmLabels,
    );
    this.#ownDroppedSeries.total++;
  }

  /** Counts a rejected record. Bypasses the label guard (bounded: one series per reason). */
  #reject(reason: TelemetryRejectReason): void {
    let series = this.#rejectedSeries.get(reason);
    if (series == undefined) {
      const labels: TelemetryLabels = Object.freeze({ reason });
      series = this.#createCounter(
        this.#selfCounters,
        buildSeriesKey(TELEMETRY_SELF_METRICS.rejectedRecords, labels),
        TELEMETRY_SELF_METRICS.rejectedRecords,
        "count",
        "telemetry",
        labels,
      );
      this.#rejectedSeries.set(reason, series);
    }
    series.total++;
  }

  /** Returns the existing counter series for `key` in `counters` or creates it (no guard check). */
  #createCounter(
    counters: Map<string, CounterSeries>,
    key: string,
    metric: string,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels: TelemetryLabels | undefined,
  ): CounterSeries {
    const existing = counters.get(key);
    if (existing != undefined) {
      return existing;
    }
    const series: CounterSeries = {
      metric,
      unit,
      scope,
      labels,
      total: 0,
      lastPublishedTotal: 0,
      publishedOnce: false,
    };
    counters.set(key, series);
    return series;
  }

  #publishGauge(series: GaugeSeries, monotonicTs: number): void {
    const sample: TelemetrySample = {
      kind: "sample",
      realm: this.#realm,
      sequence: this.#sequence++,
      monotonicTs,
      metric: series.metric,
      value: series.value,
      unit: series.unit,
      scope: series.scope,
      metricType: "gauge",
    };
    if (series.labels != undefined) {
      sample.labels = series.labels;
    }
    this.#push(sample);
  }

  // Unchanged counters are skipped after their first publish.
  #publishCounter(series: CounterSeries, monotonicTs: number): void {
    const delta = series.total - series.lastPublishedTotal;
    if (series.publishedOnce && delta === 0) {
      return;
    }
    const sample: TelemetrySample = {
      kind: "sample",
      realm: this.#realm,
      sequence: this.#sequence++,
      monotonicTs,
      metric: series.metric,
      value: series.total,
      unit: series.unit,
      scope: series.scope,
      metricType: "counter",
      delta,
    };
    if (series.labels != undefined) {
      sample.labels = series.labels;
    }
    series.lastPublishedTotal = series.total;
    series.publishedOnce = true;
    this.#push(sample);
  }

  #pushObservationSample(
    series: ObservationSeries,
    metric: string,
    value: number,
    unit: TelemetryUnit,
    metricType: TelemetrySample["metricType"],
    delta: number | undefined,
    monotonicTs: number,
  ): void {
    const sample: TelemetrySample = {
      kind: "sample",
      realm: this.#realm,
      sequence: this.#sequence++,
      monotonicTs,
      metric,
      value,
      unit,
      scope: series.scope,
      metricType,
    };
    if (delta != undefined) {
      sample.delta = delta;
    }
    if (series.labels != undefined) {
      sample.labels = series.labels;
    }
    this.#push(sample);
  }

  // Counts every live series, including the seriesCount gauge itself and the self counters.
  #updateSeriesCount(): void {
    this.#seriesCountSeries ??= {
      metric: TELEMETRY_SELF_METRICS.seriesCount,
      unit: "count",
      scope: "telemetry",
      labels: undefined,
      value: 0,
    };
    this.#seriesCountSeries.value =
      this.#gauges.size +
      1 +
      this.#counters.size +
      this.#selfCounters.size +
      this.#observations.size;
  }
}
