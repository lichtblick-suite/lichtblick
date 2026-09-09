// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback } from "react";

import { ChartDatasets } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { createLabel } from "@lichtblick/suite-base/panels/StateTransitions/messagesToDataset";
import { getValueAtTime } from "@lichtblick/suite-base/panels/StateTransitions/shared";
import {
  DeltaMarker,
  DeltaMarkerSeriesValue,
} from "@lichtblick/suite-base/panels/shared/deltaMarkers";
import useDeltaMarkerState from "@lichtblick/suite-base/panels/shared/useDeltaMarkerState";
import useDeltaMarkerSync from "@lichtblick/suite-base/panels/shared/useDeltaMarkerSync";

export type UseStateTransitionsDeltaModeProps = {
  datasets: ChartDatasets;
  /** Markers are cleared (but the mode stays active) whenever this value changes. */
  resetKey?: string;
  /** Stable id identifying this panel instance to other synced panels. */
  subscriberId: string;
  /** Whether marker positions should be synced with other synced panels. */
  syncEnabled: boolean;
};

export type UseStateTransitionsDeltaModeResult = {
  active: boolean;
  toggleActive: () => void;
  markerA: DeltaMarker | undefined;
  markerB: DeltaMarker | undefined;
  removeMarkerA: () => void;
  removeMarkerB: () => void;
  handleChartClick: (xValue: number) => void;
};

function useStateTransitionsDeltaMode({
  datasets,
  resetKey,
  subscriberId,
  syncEnabled,
}: UseStateTransitionsDeltaModeProps): UseStateTransitionsDeltaModeResult {
  const {
    active,
    toggleActive,
    markerA,
    markerB,
    removeMarkerA,
    removeMarkerB,
    nextMarkerSlot,
    setMarker,
    setMarkers,
  } = useDeltaMarkerState({ resetKey });

  const resolveSeriesValuesAtXValue = useCallback(
    (xValue: number): DeltaMarkerSeriesValue[] => {
      const seriesValues: DeltaMarkerSeriesValue[] = [];
      datasets.forEach((dataset, configIndex) => {
        const valueAtTime = getValueAtTime(dataset.data, xValue);
        if (valueAtTime) {
          seriesValues.push({
            configIndex,
            value: createLabel(valueAtTime.constantName, valueAtTime.value),
          });
        }
      });
      return seriesValues;
    },
    [datasets],
  );

  const handleChartClick = useCallback(
    (xValue: number) => {
      if (!active) {
        return;
      }

      setMarker(nextMarkerSlot(), { xValue, seriesValues: resolveSeriesValuesAtXValue(xValue) });
    },
    [active, nextMarkerSlot, resolveSeriesValuesAtXValue, setMarker],
  );

  const resolveMarkerAtXValue = useCallback(
    (xValue: number | undefined): DeltaMarker | undefined =>
      xValue == undefined ? undefined : { xValue, seriesValues: resolveSeriesValuesAtXValue(xValue) },
    [resolveSeriesValuesAtXValue],
  );

  // Both markers are committed together in one setMarkers call - resolving/committing them
  // separately can leak an intermediate state where only one slot reflects the update, which
  // then gets rebroadcast and can stomp the other synced panel.
  const handleRemoteMarkers = useCallback(
    (markerAXValue: number | undefined, markerBXValue: number | undefined) => {
      setMarkers(resolveMarkerAtXValue(markerAXValue), resolveMarkerAtXValue(markerBXValue));
    },
    [resolveMarkerAtXValue, setMarkers],
  );

  useDeltaMarkerSync({
    subscriberId,
    enabled: syncEnabled && active,
    markerA,
    markerB,
    onRemoteMarkers: handleRemoteMarkers,
  });

  return {
    active,
    toggleActive,
    markerA,
    markerB,
    removeMarkerA,
    removeMarkerB,
    handleChartClick,
  };
}

export default useStateTransitionsDeltaMode;
