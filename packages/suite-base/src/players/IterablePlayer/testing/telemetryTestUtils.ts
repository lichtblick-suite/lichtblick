// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  BufferedTelemetrySink,
  setTelemetrySink,
  type TelemetryRecord,
  type TelemetrySample,
} from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";
import { TelemetryMock } from "@lichtblick/suite-base/util/telemetry/builders/types";

/**
 * Installs an enabled buffered sink (no publish timer) as the realm sink. Callers reset it with
 * `setTelemetrySink(undefined)` after each test.
 */
export function installTestTelemetrySink(realm = "renderer"): BufferedTelemetrySink {
  const sink = new BufferedTelemetrySink({
    realm,
    setInterval: jest.fn(),
    clearInterval: jest.fn(),
  });
  setTelemetrySink(sink);
  return sink;
}

/** Installs a disabled telemetry double as the realm sink, to assert that nothing is recorded. */
export function installDisabledTelemetry(): TelemetryMock {
  const telemetry = TelemetryBuilder.mockTelemetry({ enabled: false });
  setTelemetrySink(telemetry);
  return telemetry;
}

/** Last sample per metric among `records` (gauges: latest value; counters: cumulative total). */
export function latestSamplesByMetric(records: TelemetryRecord[]): Map<string, TelemetrySample> {
  const byMetric = new Map<string, TelemetrySample>();
  for (const record of records) {
    if (record.kind === "sample") {
      byMetric.set(record.metric, record);
    }
  }
  return byMetric;
}

/** Publishes the sink's current series and returns the last sample per metric. */
export function publishAndCollect(sink: BufferedTelemetrySink): Map<string, TelemetrySample> {
  sink.publishNow();
  return latestSamplesByMetric(sink.drain().records);
}
