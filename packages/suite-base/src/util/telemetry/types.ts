// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type TelemetryUnit = "bytes" | "count" | "ms" | "percent" | "fps" | "ratio";

export type TelemetryScope =
  | "process"
  | "renderer"
  | "worker"
  | "pipeline"
  | "panel"
  | "app"
  | "telemetry";

export type TelemetryLabels = Readonly<Record<string, string>>;

export type TelemetryPhase = "start" | "end" | "instant";

/**
 * Minimum lifecycle event set (others deferred).
 * Names are dot-namespaced and must stay stable: downstream reports key on them.
 *
 * - `app.ready`: instant
 * - `datasource.open`: start = open requested, end = initialized
 * - `datasource.firstMessage`: instant
 * - `frame.firstUseful`: instant
 * - `preload`: start / end, at most one phase per player: an end with a `reason` label
 *   (`cancelled` / `error`) is final and a later full subscription does not restart it
 * - `playback`: start / end
 * - `seek.requested`: instant, emitted when a seek is requested; the seek may be deferred until
 *   initialization completes or be a no-op (already at / already seeking to that time)
 * - `datasource.close`: start = close requested, end = cleanup complete
 * - `layout.applied`: instant, the current layout finished loading/applying
 * - `panel.mount`: instant, labels `{ panelId, panelType }`
 * - `panel.unmount`: instant (panel dispose), labels `{ panelId, panelType }`
 * - `panel.firstRender`: instant, labels `{ panelId, panelType }`, first completed render of a panel
 *
 * Panel labels use the layout panel id (e.g. `Plot!abc`), never the user-visible title.
 */
export type TelemetryEventName =
  | "app.ready"
  | "datasource.open"
  | "datasource.firstMessage"
  | "frame.firstUseful"
  | "preload"
  | "playback"
  | "seek.requested"
  | "datasource.close"
  | "layout.applied"
  | "panel.mount"
  | "panel.unmount"
  | "panel.firstRender";

export type TelemetrySample = {
  kind: "sample";
  realm: string;
  sequence: number;
  monotonicTs: number;
  metric: string;
  value: number;
  unit: TelemetryUnit;
  scope: TelemetryScope;
  metricType: "gauge" | "counter";
  /** counters only: increase since previous publish of this series; never negative */
  delta?: number;
  labels?: TelemetryLabels;
};

export type TelemetryEvent = {
  kind: "event";
  realm: string;
  sequence: number;
  monotonicTs: number;
  name: TelemetryEventName;
  phase: TelemetryPhase;
  scope: TelemetryScope;
  labels?: TelemetryLabels;
};

export type TelemetryRecord = TelemetrySample | TelemetryEvent;

export type TelemetryBatch = {
  realm: string;
  records: TelemetryRecord[];
  /** Number of records dropped by the producer since its previous batch. */
  dropped: number;
};

/** Reason a record was rejected (reported via the `telemetry.rejectedRecords` self metric). */
export type TelemetryRejectReason =
  | "unknownLabel"
  | "cardinality"
  | "invalidValue"
  /** a caller used a metric name reserved for the sink's own self-metrics */
  | "reservedName";

/**
 * Telemetry recording API.
 *
 * Reserved names: `telemetry.droppedRecords`, `telemetry.rejectedRecords` and
 * `telemetry.seriesCount` (`TELEMETRY_SELF_METRICS`) are the sink's own self-metrics. Recording
 * them through `gauge()`, `counter()` or `observe()` is rejected and counted in
 * `telemetry.rejectedRecords{reason="reservedName"}`. Other names, including other `telemetry.*`
 * names (e.g. `telemetry.self.*`), may be used freely. Records forwarded with `ingest()` keep
 * their realm, sequence and timestamps and skip the reserved-name check (they carry the producing
 * realm's own self-metrics), but pass the same label guard as direct calls and can be rejected
 * (counted in `telemetry.rejectedRecords`).
 */
export interface ITelemetry {
  /** Cheap check; call sites must test this before building labels/values. */
  isEnabled(): boolean;
  /** last-value-wins; published at the publish cadence (1 Hz) */
  gauge(
    metric: string,
    value: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void;
  /**
   * monotonically increasing; increment must be >= 0 (negative/NaN increments, and increments that
   * would overflow the total to Infinity, are rejected and counted)
   */
  counter(
    metric: string,
    increment: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void;
  /**
   * Aggregated observation (histogram-lite) for per-occurrence values such as durations.
   * Every call is folded into a per-series window (count / sum / max). At each publish, a window
   * with at least one observation produces `${metric}.count` (counter, unit "count"),
   * `${metric}.sum` (counter, `unit`) and `${metric}.max` (gauge, `unit`, max within the window);
   * empty windows produce nothing. `value` must be finite and >= 0 (otherwise rejected and counted).
   */
  observe(
    metric: string,
    value: number,
    unit: TelemetryUnit,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void;
  /** event-driven, recorded immediately */
  event(
    name: TelemetryEventName,
    phase: TelemetryPhase,
    scope: TelemetryScope,
    labels?: TelemetryLabels,
  ): void;
  /**
   * Accept a batch produced by another realm (e.g. a worker). Records keep their
   * realm/sequence/timestamps and pass the label guard (rejections are counted in
   * `telemetry.rejectedRecords`).
   */
  ingest(batch: TelemetryBatch): void;
}

export type BufferedTelemetrySinkOptions = {
  /** Realm identifier stamped on every own record, e.g. "renderer", "worker:mcap-1". */
  realm: string;
  /** Ring buffer capacity in records. Default 8192. */
  capacity?: number;
  /** Publish cadence for gauges/counters once `start()` is called. Default 1000 ms. */
  publishIntervalMs?: number;
  /** Max distinct label sets per metric / event name. Default 64. */
  maxSeriesPerMetric?: number;
  /** Monotonic clock. Default `monotonicNow`. */
  now?: () => number;
  /** Injectable timer (tests). Default `globalThis.setInterval`. */
  setInterval?: (handler: () => void, intervalMs: number) => unknown;
  /** Injectable timer (tests). Default `globalThis.clearInterval`. */
  clearInterval?: (handle: unknown) => void;
  /** Synchronous observer for recorded events (own and ingested). Used by benchmark collectors. */
  onEvent?: (event: TelemetryEvent) => void;
};
