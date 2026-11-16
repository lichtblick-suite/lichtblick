// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ToggleableTelemetrySink } from "./ToggleableTelemetrySink";

function buildSink(): ToggleableTelemetrySink {
  return new ToggleableTelemetrySink({
    realm: "renderer",
    now: () => 1000,
    setInterval: () => 1,
    clearInterval: () => {},
  });
}

const WORKER_BATCH = {
  realm: "worker:1",
  records: [
    {
      kind: "event" as const,
      realm: "worker:1",
      sequence: 0,
      monotonicTs: 1,
      name: "datasource.open" as const,
      phase: "start" as const,
      scope: "pipeline" as const,
    },
  ],
  dropped: 0,
};

describe("ToggleableTelemetrySink", () => {
  it("should record like a buffered sink while active", () => {
    // Given
    const sink = buildSink();

    // When
    sink.counter("pipeline.test", 1, "count", "pipeline");
    sink.event("app.ready", "instant", "app");
    sink.publishNow();

    // Then
    expect(sink.isEnabled()).toBe(true);
    const records = sink.drain().records;
    expect(records.filter((record) => record.kind === "event")).toHaveLength(1);
    expect(
      records.some((record) => record.kind === "sample" && record.metric === "pipeline.test"),
    ).toBe(true);
  });

  it("should drop every recording call and report disabled while inactive", () => {
    // Given
    const sink = buildSink();
    sink.setActive({ active: false });

    // When
    sink.gauge("pipeline.gauge", 1, "count", "pipeline");
    sink.counter("pipeline.counter", 1, "count", "pipeline");
    sink.observe("pipeline.observe", 1, "ms", "pipeline");
    sink.event("app.ready", "instant", "app");
    sink.ingest(WORKER_BATCH);
    sink.publishNow();

    // Then
    expect(sink.isEnabled()).toBe(false);
    expect(sink.isActive()).toBe(false);
    expect(sink.drain().records).toEqual([]);
  });

  it("should keep records buffered before the switch drainable", () => {
    // Given
    const sink = buildSink();
    sink.event("app.ready", "instant", "app");

    // When
    sink.setActive({ active: false });

    // Then
    expect(sink.drain().records).toHaveLength(1);
  });

  it("should record again after being reactivated", () => {
    // Given
    const sink = buildSink();
    sink.setActive({ active: false });

    // When
    sink.setActive({ active: true });
    sink.ingest(WORKER_BATCH);

    // Then
    expect(sink.isEnabled()).toBe(true);
    expect(sink.drain().records).toHaveLength(1);
  });

  it("should stay disabled after dispose even when active", () => {
    // Given
    const sink = buildSink();

    // When
    sink.dispose();
    sink.setActive({ active: true });

    // Then
    expect(sink.isEnabled()).toBe(false);
  });
});
