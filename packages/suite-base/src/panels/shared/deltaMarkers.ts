// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  DeltaDisplay,
  DeltaMarker,
  DeltaResult,
  DeltaSeriesResult,
} from "@lichtblick/suite-base/panels/shared/types";

// Series are matched by configIndex; all series present on either marker are included.
export function computeDelta(markerA: DeltaMarker, markerB: DeltaMarker): DeltaResult {
  const valueAtAByConfigIndex = new Map(
    markerA.seriesValues.map(({ configIndex, value }) => [configIndex, value]),
  );
  const valueAtBByConfigIndex = new Map(
    markerB.seriesValues.map(({ configIndex, value }) => [configIndex, value]),
  );

  const allConfigIndexes = getDeltaSeriesConfigIndexes(markerA, markerB);

  const series: DeltaSeriesResult[] = allConfigIndexes.map((configIndex) => {
    const valueAtA = valueAtAByConfigIndex.get(configIndex);
    const valueAtB = valueAtBByConfigIndex.get(configIndex);
    const delta =
      typeof valueAtA === "number" && typeof valueAtB === "number"
        ? Math.abs(valueAtB - valueAtA)
        : undefined;

    return {
      configIndex,
      valueAtA,
      valueAtB,
      delta,
    };
  });

  const primaryA = markerA.seriesValues[0]?.value;
  const primaryB = markerB.seriesValues[0]?.value;
  const deltaY =
    typeof primaryA === "number" && typeof primaryB === "number"
      ? Math.abs(primaryB - primaryA)
      : undefined;

  return {
    deltaX: Math.abs(markerB.xValue - markerA.xValue),
    deltaY,
    series,
  };
}

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
    deltaY: undefined,
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
