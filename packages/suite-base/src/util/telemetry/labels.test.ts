// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryBuilder } from "./builders/TelemetryBuilder";
import { ALLOWED_TELEMETRY_LABEL_KEYS, DEFAULT_MAX_SERIES_PER_METRIC } from "./constants";
import { buildSeriesKey, TelemetryLabelGuard } from "./labels";

describe("buildSeriesKey", () => {
  it("returns the metric name itself when there are no labels", () => {
    // Given
    const metric = TelemetryBuilder.metric();

    // When
    const withUndefined = buildSeriesKey(metric, undefined);
    const withEmpty = buildSeriesKey(metric, {});

    // Then
    expect(withUndefined).toBe(metric);
    expect(withEmpty).toBe(metric);
  });

  it("sorts labels by key so insertion order does not matter", () => {
    // Given
    const metric = TelemetryBuilder.metric();

    // When
    const a = buildSeriesKey(metric, { sourceId: "s", poolId: "p" });
    const b = buildSeriesKey(metric, { poolId: "p", sourceId: "s" });

    // Then
    expect(a).toBe(b);
    expect(a).toBe(`${metric}{poolId="p",sourceId="s"}`);
  });

  it("orders label keys by code unit, independent of the locale", () => {
    // Given
    const metric = TelemetryBuilder.metric();

    // When
    const key = buildSeriesKey(metric, { b: "1", B: "2", a: "3", _: "4" });

    // Then
    expect(key).toBe(`${metric}{B="2",_="4",a="3",b="1"}`);
  });

  it("quotes values so distinct label sets never collide", () => {
    // Given
    const metric = TelemetryBuilder.metric();

    // When
    const a = buildSeriesKey(metric, { poolId: 'x",sourceId="y' });
    const b = buildSeriesKey(metric, { poolId: "x", sourceId: "y" });

    // Then
    expect(a).not.toBe(b);
  });
});

describe("TelemetryLabelGuard", () => {
  it("admits series without labels and with allow-listed keys", () => {
    // Given
    const guard = new TelemetryLabelGuard();
    const metric = TelemetryBuilder.metric();
    const labels = { sourceId: "a", realm: "renderer" };

    // When
    const noLabels = guard.admit(metric, metric, undefined);
    const allowed = guard.admit(metric, buildSeriesKey(metric, labels), labels);

    // Then
    expect(noLabels).toBeUndefined();
    expect(allowed).toBeUndefined();
  });

  it("allows exactly the documented label keys", () => {
    // Given / When
    const keys = [...ALLOWED_TELEMETRY_LABEL_KEYS].sort();

    // Then
    expect(keys).toEqual(
      [
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
      ].sort(),
    );
  });

  it("rejects label sets containing an unknown key", () => {
    // Given
    const guard = new TelemetryLabelGuard();
    const metric = TelemetryBuilder.metric();
    const labels = { sourceId: "a", topic: "/secret" };

    // When
    const result = guard.admit(metric, buildSeriesKey(metric, labels), labels);

    // Then
    expect(result).toBe("unknownLabel");
  });

  it("rejects the 65th distinct label set of a metric but keeps admitting known ones", () => {
    // Given
    const guard = new TelemetryLabelGuard();
    const metric = TelemetryBuilder.metric();
    const admit = (i: number) => {
      const labels = { sourceId: `s${i}` };
      return guard.admit(metric, buildSeriesKey(metric, labels), labels);
    };
    for (let i = 0; i < DEFAULT_MAX_SERIES_PER_METRIC; i++) {
      expect(admit(i)).toBeUndefined();
    }

    // When
    const overflow = admit(DEFAULT_MAX_SERIES_PER_METRIC);
    const known = admit(0);
    const otherMetric = guard.admit(TelemetryBuilder.metric(), "other", { sourceId: "x" });

    // Then
    expect(overflow).toBe("cardinality");
    expect(known).toBeUndefined();
    expect(otherMetric).toBeUndefined();
  });

  it("forgets admitted series on clear", () => {
    // Given
    const guard = new TelemetryLabelGuard(1);
    const metric = TelemetryBuilder.metric();
    expect(guard.admit(metric, "a", { sourceId: "a" })).toBeUndefined();
    expect(guard.admit(metric, "b", { sourceId: "b" })).toBe("cardinality");

    // When
    guard.clear();

    // Then
    expect(guard.admit(metric, "b", { sourceId: "b" })).toBeUndefined();
  });

  it("rejects an invalid maxSeriesPerMetric", () => {
    // Given / When
    const create = () => new TelemetryLabelGuard(0);

    // Then
    expect(create).toThrow();
  });
});
