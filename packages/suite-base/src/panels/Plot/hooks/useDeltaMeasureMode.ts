// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MutableRefObject, useCallback } from "react";
import { useMountedState } from "react-use";

import { isTime, toSec } from "@lichtblick/rostime";
import type { OffscreenCanvasRenderer } from "@lichtblick/suite-base/panels/Plot/OffscreenCanvasRenderer";
import type { PlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import { OriginalValue } from "@lichtblick/suite-base/panels/Plot/utils/datum";
import {
  DeltaMarker,
  DeltaMarkerSeriesValue,
} from "@lichtblick/suite-base/panels/shared/deltaMarkers";
import useDeltaMarkerState from "@lichtblick/suite-base/panels/shared/useDeltaMarkerState";

export type UseDeltaMeasureModeProps = {
  coordinator: PlotCoordinator | undefined;
  renderer: OffscreenCanvasRenderer | undefined;
  draggingRef: MutableRefObject<boolean>;
  /** Markers are cleared (but the mode stays active) whenever this value changes. */
  resetKey?: string;
};

export type UseDeltaMeasureModeResult = {
  active: boolean;
  toggleActive: () => void;
  markerA: DeltaMarker | undefined;
  markerB: DeltaMarker | undefined;
  removeMarkerA: () => void;
  removeMarkerB: () => void;
  handleCanvasClick: (event: React.MouseEvent<HTMLElement>) => void;
};

// bigint/boolean/Time don't have a natural delta - normalize them into what computeDelta expects.
function toSeriesValue(value: OriginalValue | undefined): number | string | undefined {
  switch (typeof value) {
    case "number":
    case "string":
      return value;
    case "bigint":
      return Number(value);
    case "boolean":
      return String(value);
    case "object":
      return isTime(value) ? toSec(value) : undefined;
    default:
      return undefined;
  }
}

function useDeltaMeasureMode({
  coordinator,
  renderer,
  draggingRef,
  resetKey,
}: UseDeltaMeasureModeProps): UseDeltaMeasureModeResult {
  const isMounted = useMountedState();
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

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!active || draggingRef.current || !coordinator) {
        return;
      }

      const boundingRect = event.currentTarget.getBoundingClientRect();
      const canvasX = event.clientX - boundingRect.left;
      const canvasY = event.clientY - boundingRect.top;
      const xValue = coordinator.getXValueAtPixel(canvasX);

      // Decide the target slot now since the datum lookup below is async - a third click resets.
      const slot = nextMarkerSlot();

      void (async () => {
        const elements = (await renderer?.getElementsAtPixel({ x: canvasX, y: canvasY })) ?? [];
        if (!isMounted()) {
          return;
        }

        const seriesValues: DeltaMarkerSeriesValue[] = [];
        const seenConfigIndexes = new Set<number>();
        for (const element of elements) {
          if (seenConfigIndexes.has(element.configIndex)) {
            continue;
          }
          seenConfigIndexes.add(element.configIndex);

          const value = toSeriesValue(element.data.value ?? element.data.y);
          if (value != undefined) {
            seriesValues.push({ configIndex: element.configIndex, value });
          }
        }

        setMarker(slot, { xValue, seriesValues });
      })();
    },
    [active, coordinator, draggingRef, isMounted, nextMarkerSlot, renderer, setMarker],
  );

  return {
    active,
    toggleActive,
    markerA,
    markerB,
    removeMarkerA,
    removeMarkerB,
    handleCanvasClick,
  };
}

export default useDeltaMeasureMode;
