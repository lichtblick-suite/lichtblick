// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** Default ring-buffer size (records) of a `BufferedTelemetrySink`. */
export const DEFAULT_TELEMETRY_CAPACITY = 8192;

/** Default interval between two periodic publishes of a `BufferedTelemetrySink`. */
export const DEFAULT_TELEMETRY_PUBLISH_INTERVAL_MS = 1000;

/** Default cap on distinct label sets per metric (or event name) enforced by the label guard. */
export const DEFAULT_MAX_SERIES_PER_METRIC = 64;

/** Names of the metrics the sink reports about itself (scope "telemetry"). */
export const TELEMETRY_SELF_METRICS = {
  /** counter, label `realm`: records lost to ring-buffer overflow (own and foreign realms) */
  droppedRecords: "telemetry.droppedRecords",
  /** counter, label `reason`: records rejected by validation / the label guard */
  rejectedRecords: "telemetry.rejectedRecords",
  /** gauge: number of live gauge + counter + observation series in this sink */
  seriesCount: "telemetry.seriesCount",
} as const;

/** Label keys that may be attached to telemetry records. Anything else is rejected. */
export const ALLOWED_TELEMETRY_LABEL_KEYS: ReadonlySet<string> = new Set([
  "sourceId",
  "poolId",
  "panelId",
  "panelType",
  "processType",
  "pid",
  "platform",
  "scenarioId",
  "realm",
  "reason",
  "iteratorId",
]);
