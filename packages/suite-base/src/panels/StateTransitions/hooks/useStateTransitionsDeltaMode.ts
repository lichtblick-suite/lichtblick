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

export type UseStateTransitionsDeltaModeProps = {
  datasets: ChartDatasets;
  /** Markers are cleared (but the mode stays active) whenever this value changes. */
  resetKey?: string;
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
  } = useDeltaMarkerState({ resetKey });

  const handleChartClick = useCallback(
    (xValue: number) => {
      if (!active) {
        return;
      }

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

      setMarker(nextMarkerSlot(), { xValue, seriesValues });
    },
    [active, datasets, nextMarkerSlot, setMarker],
  );

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
