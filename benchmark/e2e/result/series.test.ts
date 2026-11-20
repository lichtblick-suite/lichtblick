// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryRecordBuilder } from "./builders/TelemetryRecordBuilder";
import {
  counterTotal,
  counterTotalAt,
  gaugePeakOfTotal,
  indexByMetric,
  seriesKey,
  summarizeObservation,
} from "./series";

const METRIC = "pipeline.messages.received";

describe("seriesKey", () => {
  it("should identify a series by realm, metric and labels regardless of label order", () => {
    // Given the same labels in a different insertion order, and another realm
    const a = TelemetryRecordBuilder.sample({ metric: "m", value: 1, labels: { b: "2", a: "1" } });
    const b = TelemetryRecordBuilder.sample({ metric: "m", value: 2, labels: { a: "1", b: "2" } });
    const worker = TelemetryRecordBuilder.sample({ realm: "worker:1", metric: "m", value: 1 });

    // When / Then
    expect(seriesKey(a)).toBe(seriesKey(b));
    expect(seriesKey(worker)).not.toBe(seriesKey(a));
  });
});

describe("counterTotal / counterTotalAt", () => {
  it("should take the last cumulative value per series and sum over series", () => {
    // Given a renderer series (one intermediate publish dropped) and a worker series
    const samples = [
      ...TelemetryRecordBuilder.counterSeries(METRIC, [
        [1000, 10],
        [3000, 30],
      ]),
      ...TelemetryRecordBuilder.counterSeries(
        METRIC,
        [
          [1500, 5],
          [2500, 7],
        ],
        { realm: "worker:1" },
      ),
    ];

    // When / Then
    expect(counterTotal(samples)).toBe(37);
    expect(counterTotalAt(samples, 2000)).toBe(15);
    expect(counterTotalAt(samples, 999)).toBeUndefined();
  });

  it("should be independent of the input order and return undefined without samples", () => {
    // Given publishes in reverse order
    const samples = TelemetryRecordBuilder.counterSeries(METRIC, [
      [1000, 1],
      [2000, 4],
    ]).reverse();

    // When / Then
    expect(counterTotal(samples)).toBe(4);
    expect(counterTotal([])).toBeUndefined();
    expect(counterTotal(undefined)).toBeUndefined();
  });
});

describe("gaugePeakOfTotal", () => {
  it("should return the peak of the per-publish sum across series", () => {
    // Given two series whose individual peaks do not coincide
    const samples = [
      ...TelemetryRecordBuilder.gaugeSeries("g", [
        [1000, 10],
        [2000, 2],
      ]),
      ...TelemetryRecordBuilder.gaugeSeries(
        "g",
        [
          [1000, 1],
          [2000, 8],
        ],
        { labels: { sourceId: "b" } },
      ),
    ];

    // When
    const peak = gaugePeakOfTotal(samples);

    // Then max(10 + 1, 2 + 8), not 10 + 8
    expect(peak).toBe(11);
  });

  it("should return the plain maximum for one series and undefined without samples", () => {
    // Given / When / Then
    expect(
      gaugePeakOfTotal(
        TelemetryRecordBuilder.gaugeSeries("g", [
          [1, 3],
          [2, 9],
          [3, 4],
        ]),
      ),
    ).toBe(9);
    expect(gaugePeakOfTotal([])).toBeUndefined();
  });
});

describe("summarizeObservation", () => {
  it("should aggregate count, sum, mean, max and p90 of the window maxima over realms", () => {
    // Given one observation series in the renderer and one in a worker
    const samples = [
      ...TelemetryRecordBuilder.observationSeries("d", [
        [1000, 2, 4, 3],
        [2000, 1, 9, 9],
      ]),
      ...TelemetryRecordBuilder.observationSeries("d", [[1500, 3, 2, 1]], { realm: "worker:1" }),
    ];

    // When
    const summary = summarizeObservation(indexByMetric(samples), "d");

    // Then
    expect(summary).toEqual({ count: 6, sum: 15, mean: 2.5, max: 9, p90WindowMax: 9 });
  });

  it("should omit the mean without observations and return undefined without publishes", () => {
    // Given only a max gauge (count/sum dropped)
    const onlyMax = TelemetryRecordBuilder.gaugeSeries("d.max", [[1000, 4]]);

    // When / Then
    expect(summarizeObservation(indexByMetric(onlyMax), "d")).toEqual({
      count: 0,
      sum: 0,
      max: 4,
      p90WindowMax: 4,
    });
    expect(summarizeObservation(indexByMetric([]), "d")).toBeUndefined();
  });
});
