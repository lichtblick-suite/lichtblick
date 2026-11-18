// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { NOOP_TELEMETRY, NoopTelemetry } from "./NoopTelemetry";
import { TelemetryBuilder } from "./builders/TelemetryBuilder";

describe("NoopTelemetry", () => {
  it("reports disabled", () => {
    // Given
    const telemetry = new NoopTelemetry();

    // When
    const enabled = telemetry.isEnabled();

    // Then
    expect(enabled).toBe(false);
  });

  it("accepts every recording call without side effects", () => {
    // Given
    const metric = TelemetryBuilder.metric();

    // When
    const record = (): void => {
      NOOP_TELEMETRY.gauge(metric, 1, "bytes", "renderer", { sourceId: "a" });
      NOOP_TELEMETRY.counter(metric, 1, "count", "worker");
      NOOP_TELEMETRY.observe(metric, 1, "ms", "panel", { panelId: "Plot!a" });
      NOOP_TELEMETRY.event("app.ready", "instant", "app");
      NOOP_TELEMETRY.ingest(TelemetryBuilder.batch());
    };

    // Then
    expect(record).not.toThrow();
    expect(NOOP_TELEMETRY).toBeInstanceOf(NoopTelemetry);
    expect(NOOP_TELEMETRY.isEnabled()).toBe(false);
  });
});
