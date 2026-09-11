// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import DeltaMarkerBuilder from "@lichtblick/suite-base/testing/builders/DeltaMarkerBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { computeDelta, computeDeltaDisplay, getDeltaSeriesConfigIndexes } from "./deltaMarkers";

describe("computeDelta", () => {
  const buildMarker = DeltaMarkerBuilder.marker;

  it("should compute the delta between the x values of both markers", () => {
    // Given
    const markerA = buildMarker({ xValue: 10 });
    const markerB = buildMarker({ xValue: 25 });

    // When
    const result = computeDelta(markerA, markerB);

    // Then
    expect(result.deltaX).toEqual(15);
  });

  it("should return a positive deltaX when marker B was placed before marker A in time", () => {
    // Given
    const markerA = buildMarker({ xValue: 25 });
    const markerB = buildMarker({ xValue: 10 });

    // When
    const result = computeDelta(markerA, markerB);

    // Then
    expect(result.deltaX).toEqual(15);
  });

  it("should compute the numeric delta for a series present on both markers", () => {
    // Given
    const configIndex = BasicBuilder.number();
    const markerA = buildMarker({ seriesValues: [{ configIndex, value: 5 }] });
    const markerB = buildMarker({ seriesValues: [{ configIndex, value: 12 }] });

    // When
    const result = computeDelta(markerA, markerB);

    // Then
    expect(result.series).toEqual([{ configIndex, valueAtA: 5, valueAtB: 12, delta: 7 }]);
  });

  it("should leave delta undefined when values are strings (e.g. StateTransitions state labels)", () => {
    // Given
    const configIndex = BasicBuilder.number();
    const markerA = buildMarker({
      seriesValues: [{ configIndex, value: "IDLE" }],
    });
    const markerB = buildMarker({
      seriesValues: [{ configIndex, value: "RUNNING" }],
    });

    // When
    const result = computeDelta(markerA, markerB);

    // Then
    expect(result.series).toEqual([
      { configIndex, valueAtA: "IDLE", valueAtB: "RUNNING", delta: undefined },
    ]);
  });

  it("should return a positive series delta when marker B's value is lower than marker A's", () => {
    // Given
    const configIndex = BasicBuilder.number();
    const markerA = buildMarker({ seriesValues: [{ configIndex, value: 12 }] });
    const markerB = buildMarker({ seriesValues: [{ configIndex, value: 5 }] });

    // When
    const result = computeDelta(markerA, markerB);

    // Then
    expect(result.series).toEqual([{ configIndex, valueAtA: 12, valueAtB: 5, delta: 7 }]);
  });

  it("should skip series that are only present on one marker", () => {
    // Given
    const sharedIndex = BasicBuilder.number();
    const onlyOnAIndex = sharedIndex + 1;
    const markerA = buildMarker({
      seriesValues: [
        { configIndex: sharedIndex, value: 1 },
        { configIndex: onlyOnAIndex, value: 2 },
      ],
    });
    const markerB = buildMarker({
      seriesValues: [{ configIndex: sharedIndex, value: 3 }],
    });

    // When
    const result = computeDelta(markerA, markerB);

    // Then
    expect(result.series).toEqual([
      { configIndex: sharedIndex, valueAtA: 1, valueAtB: 3, delta: 2 },
    ]);
  });

  it("should return an empty series list when neither marker has series values", () => {
    // Given
    const markerA = buildMarker();
    const markerB = buildMarker();

    // When
    const result = computeDelta(markerA, markerB);

    // Then
    expect(result.series).toEqual([]);
  });
});

describe("getDeltaSeriesConfigIndexes", () => {
  const buildMarker = DeltaMarkerBuilder.marker;

  it("should sort config indexes numerically, not lexicographically", () => {
    // Given
    const markerA = buildMarker({
      seriesValues: [
        { configIndex: 2, value: 1 },
        { configIndex: 10, value: 1 },
      ],
    });
    const markerB = buildMarker({
      seriesValues: [{ configIndex: 1, value: 1 }],
    });

    // When
    const result = getDeltaSeriesConfigIndexes(markerA, markerB);

    // Then
    expect(result).toEqual([1, 2, 10]);
  });

  it("should de-duplicate config indexes present on both markers", () => {
    // Given
    const sharedIndex = BasicBuilder.number();
    const markerA = buildMarker({
      seriesValues: [{ configIndex: sharedIndex, value: 1 }],
    });
    const markerB = buildMarker({
      seriesValues: [{ configIndex: sharedIndex, value: 2 }],
    });

    // When
    const result = getDeltaSeriesConfigIndexes(markerA, markerB);

    // Then
    expect(result).toEqual([sharedIndex]);
  });

  it("should include config indexes present on only one marker", () => {
    // Given
    const onlyOnAIndex = BasicBuilder.number({ min: 0, max: 10 });
    const onlyOnBIndex = onlyOnAIndex + 100;
    const markerA = buildMarker({
      seriesValues: [{ configIndex: onlyOnAIndex, value: 1 }],
    });
    const markerB = buildMarker({
      seriesValues: [{ configIndex: onlyOnBIndex, value: 2 }],
    });

    // When
    const result = getDeltaSeriesConfigIndexes(markerA, markerB);

    // Then
    expect(result).toEqual([onlyOnAIndex, onlyOnBIndex]);
  });

  it("should return an empty array when neither marker has series values", () => {
    // Given
    const markerA = buildMarker();
    const markerB = buildMarker();

    // When
    const result = getDeltaSeriesConfigIndexes(markerA, markerB);

    // Then
    expect(result).toEqual([]);
  });

  it("should tolerate an undefined marker on either side", () => {
    // Given
    const configIndex = BasicBuilder.number();
    const markerA = buildMarker({ seriesValues: [{ configIndex, value: 1 }] });

    // When
    const result = getDeltaSeriesConfigIndexes(markerA, undefined);

    // Then
    expect(result).toEqual([configIndex]);
  });

  it("should return an empty array when both markers are undefined", () => {
    // Given / When
    const result = getDeltaSeriesConfigIndexes(undefined, undefined);

    // Then
    expect(result).toEqual([]);
  });
});

describe("computeDeltaDisplay", () => {
  const buildMarker = DeltaMarkerBuilder.marker;

  it("should return an undefined deltaX and empty series when neither marker is set", () => {
    // Given / When
    const result = computeDeltaDisplay(undefined, undefined);

    // Then
    expect(result).toEqual({ deltaX: undefined, series: [] });
  });

  it("should list marker A's series with valueAtB undefined when only marker A is set", () => {
    // Given
    const configIndex = BasicBuilder.number();
    const markerA = buildMarker({ seriesValues: [{ configIndex, value: 5 }] });

    // When
    const result = computeDeltaDisplay(markerA, undefined);

    // Then
    expect(result).toEqual({
      deltaX: undefined,
      series: [{ configIndex, valueAtA: 5, valueAtB: undefined, delta: undefined }],
    });
  });

  it("should list marker B's series with valueAtA undefined when only marker B is set", () => {
    // Given
    const configIndex = BasicBuilder.number();
    const markerB = buildMarker({ seriesValues: [{ configIndex, value: 9 }] });

    // When
    const result = computeDeltaDisplay(undefined, markerB);

    // Then
    expect(result).toEqual({
      deltaX: undefined,
      series: [{ configIndex, valueAtA: undefined, valueAtB: 9, delta: undefined }],
    });
  });

  it("should delegate to computeDelta once both markers are set", () => {
    // Given
    const configIndex = BasicBuilder.number();
    const markerA = buildMarker({ xValue: 1, seriesValues: [{ configIndex, value: 5 }] });
    const markerB = buildMarker({ xValue: 4, seriesValues: [{ configIndex, value: 11 }] });

    // When
    const result = computeDeltaDisplay(markerA, markerB);

    // Then
    expect(result).toEqual(computeDelta(markerA, markerB));
  });
});
