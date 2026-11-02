// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Public entry point of the telemetry module. Its external consumer is the benchmark
// package (`benchmark/src/telemetry`, e.g. `installBenchmarkTelemetry` installs a
// `BufferedTelemetrySink`), which lives outside suite-base and is not covered by the
// ts-unused-exports check (it only analyzes the suite-base tsconfig). The exports suppressed below
// complete that public API (sink options, self-metric names, record field types) for the benchmark
// side even where it does not import them yet.

export { BufferedTelemetrySink } from "./BufferedTelemetrySink";
// ts-unused-exports:disable-next-line
export { TELEMETRY_SELF_METRICS } from "./constants";
export { monotonicNow } from "./clock";
export { getTelemetry, setTelemetrySink } from "./globalTelemetry";
export { NOOP_TELEMETRY } from "./NoopTelemetry";
export type {
  ITelemetry,
  TelemetryBatch,
  TelemetryEvent,
  TelemetryEventName,
  TelemetryLabels,
  TelemetryPhase,
  TelemetryRecord,
} from "./types";
// ts-unused-exports:disable-next-line
export type {
  BufferedTelemetrySinkOptions,
  TelemetryRejectReason,
  TelemetrySample,
  TelemetryScope,
  TelemetryUnit,
} from "./types";
