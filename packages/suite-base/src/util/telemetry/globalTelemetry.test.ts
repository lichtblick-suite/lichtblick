// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Imports go through the public entry point on purpose: this also guards the exported API.
import {
  BufferedTelemetrySink,
  getTelemetry,
  NOOP_TELEMETRY,
  setTelemetrySink,
} from "@lichtblick/suite-base/util/telemetry";

describe("globalTelemetry", () => {
  afterEach(() => {
    setTelemetrySink(undefined);
  });

  it("returns the no-op sink by default", () => {
    // Given / When
    const telemetry = getTelemetry();

    // Then
    expect(telemetry).toBe(NOOP_TELEMETRY);
    expect(telemetry.isEnabled()).toBe(false);
  });

  it("returns the installed sink", () => {
    // Given
    const sink = new BufferedTelemetrySink({ realm: "renderer" });

    // When
    setTelemetrySink(sink);

    // Then
    expect(getTelemetry()).toBe(sink);
    expect(getTelemetry().isEnabled()).toBe(true);
    sink.dispose();
  });

  it("resets to the no-op sink when undefined is installed", () => {
    // Given
    const sink = new BufferedTelemetrySink({ realm: "renderer" });
    setTelemetrySink(sink);

    // When
    setTelemetrySink(undefined);

    // Then
    expect(getTelemetry()).toBe(NOOP_TELEMETRY);
    sink.dispose();
  });
});
