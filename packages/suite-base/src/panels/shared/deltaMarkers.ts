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
  // Undefined when that marker isn't placed yet (DeltaOverlay shows a placeholder).
  valueAtA: number | string | undefined;
  valueAtB: number | string | undefined;
  // Absolute value; undefined when either value isn't numeric (e.g. StateTransitions state labels).
  delta: number | undefined;
};

export type DeltaResult = {
  /** Absolute value, so it doesn't flip sign depending on which marker was placed first. */
  deltaX: number;
  series: DeltaSeriesResult[];
};

// Series are matched by configIndex; a series present on only one marker is skipped.
export function computeDelta(markerA: DeltaMarker, markerB: DeltaMarker): DeltaResult {
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

export type DeltaDisplay = {
  /** Undefined until both markers are placed. */
  deltaX: number | undefined;
  series: DeltaSeriesResult[];
};

/**
 * Like `computeDelta`, but also handles the "Measure mode is active but zero or one markers have
 * been placed yet" states - the DeltaOverlay renders regardless of how many markers exist, using
 * this to fill in what's known so far and placeholders for the rest.
 */
export function computeDeltaDisplay(
  markerA: DeltaMarker | undefined,
  markerB: DeltaMarker | undefined,
): DeltaDisplay {
  if (markerA && markerB) {
    return computeDelta(markerA, markerB);
  }

  const marker = markerA ?? markerB;
  return {
    deltaX: undefined,
    series: (marker?.seriesValues ?? []).map(({ configIndex, value }) => ({
      configIndex,
      valueAtA: markerA ? value : undefined,
      valueAtB: markerB ? value : undefined,
      delta: undefined,
    })),
  };
}

/** Config indexes referenced by either marker, de-duplicated and sorted numerically ascending. */
export function getDeltaSeriesConfigIndexes(
  markerA: DeltaMarker | undefined,
  markerB: DeltaMarker | undefined,
): number[] {
  const configIndexes = new Set<number>();
  for (const seriesValue of [...(markerA?.seriesValues ?? []), ...(markerB?.seriesValues ?? [])]) {
    configIndexes.add(seriesValue.configIndex);
  }
  return [...configIndexes].sort((a, b) => a - b);
}
