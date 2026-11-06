// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { JsHeapCollector } from "./JsHeapCollector";
import { buildMockTelemetry } from "./builders/RendererCollectorsEnvBuilder";

describe("JsHeapCollector", () => {
  it("should publish used/total/limit JS heap gauges from performance.memory", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const collector = new JsHeapCollector(telemetry, {
      memory: { usedJSHeapSize: 10, totalJSHeapSize: 20, jsHeapSizeLimit: 30 },
    });

    // When
    collector.sample();

    // Then
    expect(telemetry.gauge.mock.calls).toEqual([
      ["renderer.jsHeap.usedBytes", 10, "bytes", "renderer"],
      ["renderer.jsHeap.totalBytes", 20, "bytes", "renderer"],
      ["renderer.jsHeap.limitBytes", 30, "bytes", "renderer"],
    ]);
  });

  it("should do nothing when performance.memory is not available", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const collector = new JsHeapCollector(telemetry, {});

    // When
    collector.sample();

    // Then
    expect(telemetry.gauge).not.toHaveBeenCalled();
  });

  it("should do nothing without a performance object", () => {
    // Given
    const telemetry = buildMockTelemetry();
    const collector = new JsHeapCollector(telemetry, undefined);

    // When
    collector.sample();

    // Then
    expect(telemetry.gauge).not.toHaveBeenCalled();
  });
});
