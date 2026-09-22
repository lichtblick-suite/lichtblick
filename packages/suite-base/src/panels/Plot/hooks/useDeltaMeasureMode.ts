// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback } from "react";
import { useMountedState } from "react-use";

import { isTime, toSec } from "@lichtblick/rostime";
import {
  UseDeltaMeasureModeProps,
  UseDeltaMeasureModeResult,
} from "@lichtblick/suite-base/panels/Plot/hooks/types";
import { HoverElement } from "@lichtblick/suite-base/panels/Plot/types";
import { OriginalValue } from "@lichtblick/suite-base/panels/Plot/utils/datum";
import { DeltaMarkerSeriesValue } from "@lichtblick/suite-base/panels/shared/types";
import useDeltaMarkerState from "@lichtblick/suite-base/panels/shared/useDeltaMarkerState";

// bigint/boolean/Time don't have a natural delta - normalize them into what computeDelta expects.
function toSeriesValue(value: OriginalValue | undefined): number | string | undefined {
  switch (typeof value) {
    case "number":
      return value;
    case "bigint":
      return Number(value);
    case "object":
      return isTime(value) ? toSec(value) : undefined;
    default:
      return undefined;
  }
}

// Dedupe by configIndex (elements can overlap at a pixel) and drop values that don't normalize.
function resolveSeriesValues(elements: readonly HoverElement[]): DeltaMarkerSeriesValue[] {
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
  return seriesValues;
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

  const setMarkerAtCanvasPosition = useCallback(
    async (canvasX: number, canvasY: number, xValue: number) => {
      try {
        if (!isMounted()) {
          return;
        }
        const elements = (await renderer?.getElementsAtPixel({ x: canvasX, y: canvasY })) ?? [];

        const seriesValues = resolveSeriesValues(elements);
        if (seriesValues.length === 0) {
          return;
        }

        const snappedX = typeof elements[0]?.data.x === "number" ? elements[0].data.x : xValue;
        setMarker(nextMarkerSlot(), { xValue: snappedX, seriesValues });
      } catch (err: unknown) {
        console.error(err);
      }
    },
    [isMounted, nextMarkerSlot, renderer, setMarker],
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!active || draggingRef.current || !coordinator) {
        return;
      }

      const boundingRect = event.currentTarget.getBoundingClientRect();
      const canvasX = event.clientX - boundingRect.left;
      const canvasY = event.clientY - boundingRect.top;
      const xValue = coordinator.getXValueAtPixel(canvasX);
      if (xValue === -1) {
        return;
      }

      void setMarkerAtCanvasPosition(canvasX, canvasY, xValue);
    },
    [active, coordinator, draggingRef, setMarkerAtCanvasPosition],
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
