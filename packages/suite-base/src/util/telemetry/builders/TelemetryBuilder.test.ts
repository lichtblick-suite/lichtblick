// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryBuilder } from "./TelemetryBuilder";

describe("TelemetryBuilder.mockTelemetry", () => {
  it("should report enabled when no overrides are given", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();

    // WHEN
    const enabled = telemetry.isEnabled();

    // THEN
    expect(enabled).toBe(true);
  });

  it("should report disabled when enabled is false", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry({ enabled: false });

    // WHEN
    const enabled = telemetry.isEnabled();

    // THEN
    expect(enabled).toBe(false);
  });

  it("should record calls on every recording method when they are invoked", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();
    const batch = TelemetryBuilder.batch();

    // WHEN
    telemetry.gauge("test.gauge", 1, "count", "app");
    telemetry.counter("test.counter", 2, "count", "app");
    telemetry.observe("test.observe", 3, "ms", "app");
    telemetry.event("app.ready", "instant", "app");
    telemetry.ingest(batch);

    // THEN
    expect(telemetry.gauge.mock.calls).toEqual([["test.gauge", 1, "count", "app"]]);
    expect(telemetry.counter.mock.calls).toEqual([["test.counter", 2, "count", "app"]]);
    expect(telemetry.observe.mock.calls).toEqual([["test.observe", 3, "ms", "app"]]);
    expect(telemetry.event.mock.calls).toEqual([["app.ready", "instant", "app"]]);
    expect(telemetry.ingest.mock.calls).toEqual([[batch]]);
  });

  it("should return independent mocks when called twice", () => {
    // GIVEN
    const first = TelemetryBuilder.mockTelemetry();
    const second = TelemetryBuilder.mockTelemetry();

    // WHEN
    first.counter("test.counter", 1, "count", "app");

    // THEN
    expect(second.counter.mock.calls).toEqual([]);
  });
});
