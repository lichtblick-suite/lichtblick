// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type DeltaMarkerSeriesValue = {
  configIndex: number;
  value: number | string;
};

export type DeltaMarker = {
  xValue: number;
  seriesValues: DeltaMarkerSeriesValue[];
};

export type DeltaSeriesResult = {
  configIndex: number;
  valueAtA: number | string;
  valueAtB: number | string;
  // Absolute value; undefined when either value isn't numeric (e.g. StateTransitions state labels).
  delta: number | undefined;
};

export type DeltaResult = {
  /** Absolute value, so it doesn't flip sign depending on which marker was placed first. */
  deltaX: number;
  series: DeltaSeriesResult[];
};

// Series are matched by configIndex; a series present on only one marker is skipped.
export function computeDelta(
  markerA: DeltaMarker,
  markerB: DeltaMarker,
): DeltaResult {
  const valueAtBByConfigIndex = new Map(
    markerB.seriesValues.map(({ configIndex, value }) => [configIndex, value]),
  );

  const series: DeltaSeriesResult[] = [];
  for (const { configIndex, value: valueAtA } of markerA.seriesValues) {
    const valueAtB = valueAtBByConfigIndex.get(configIndex);
    if (valueAtB == undefined) {
      continue;
    }

    series.push({
      configIndex,
      valueAtA,
      valueAtB,
      delta:
        typeof valueAtA === "number" && typeof valueAtB === "number"
          ? Math.abs(valueAtB - valueAtA)
          : undefined,
    });
  }

  return {
    deltaX: Math.abs(markerB.xValue - markerA.xValue),
    series,
  };
}

/** Config indexes referenced by either marker, de-duplicated and sorted numerically ascending. */
export function getDeltaSeriesConfigIndexes(
  markerA: DeltaMarker,
  markerB: DeltaMarker,
): number[] {
  const configIndexes = new Set<number>();
  for (const seriesValue of [
    ...markerA.seriesValues,
    ...markerB.seriesValues,
  ]) {
    configIndexes.add(seriesValue.configIndex);
  }
  return [...configIndexes].sort((a, b) => a - b);
}
