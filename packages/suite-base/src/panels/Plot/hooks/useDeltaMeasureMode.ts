// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MutableRefObject, useCallback, useRef } from "react";
import { useMountedState } from "react-use";

import { isTime, toSec } from "@lichtblick/rostime";
import type { OffscreenCanvasRenderer } from "@lichtblick/suite-base/panels/Plot/OffscreenCanvasRenderer";
import type { PlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import { HoverElement } from "@lichtblick/suite-base/panels/Plot/types";
import { OriginalValue } from "@lichtblick/suite-base/panels/Plot/utils/datum";
import {
  DeltaMarker,
  DeltaMarkerSeriesValue,
} from "@lichtblick/suite-base/panels/shared/deltaMarkers";
import useDeltaMarkerState from "@lichtblick/suite-base/panels/shared/useDeltaMarkerState";
import useDeltaMarkerSync from "@lichtblick/suite-base/panels/shared/useDeltaMarkerSync";

export type UseDeltaMeasureModeProps = {
  coordinator: PlotCoordinator | undefined;
  renderer: OffscreenCanvasRenderer | undefined;
  draggingRef: MutableRefObject<boolean>;
  /** Markers are cleared (but the mode stays active) whenever this value changes. */
  resetKey?: string;
  /** Stable id identifying this panel instance to other synced panels. */
  subscriberId: string;
  /** Whether marker positions should be synced with other synced panels (config + axis-compatibility gate). */
  syncEnabled: boolean;
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

function elementsToSeriesValues(elements: readonly HoverElement[]): DeltaMarkerSeriesValue[] {
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
  subscriberId,
  syncEnabled,
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
    setMarkers,
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
      if (xValue === -1) {
        return;
      }

      // Decide the target slot now since the datum lookup below is async - a third click resets.
      const slot = nextMarkerSlot();

      void (async () => {
        try {
          const elements = (await renderer?.getElementsAtPixel({ x: canvasX, y: canvasY })) ?? [];
          if (!isMounted()) {
            return;
          }

          setMarker(slot, { xValue, seriesValues: elementsToSeriesValues(elements) });
        } catch (err: unknown) {
          console.error(err);
        }
      })();
    },
    [active, coordinator, draggingRef, isMounted, nextMarkerSlot, renderer, setMarker],
  );

  // Resolves the marker a synced panel needs when it places/moves a marker at a given x value (no
  // click/pixel event is available in that case, so the "y" pixel is irrelevant - the chart's "x"
  // interaction mode matches by x position only).
  const resolveMarkerAtXValue = useCallback(
    async (xValue: number | undefined): Promise<DeltaMarker | undefined> => {
      if (xValue == undefined || !coordinator) {
        return undefined;
      }
      try {
        const canvasX = coordinator.getPixelForXValue(xValue);
        const elements = (await renderer?.getElementsAtPixel({ x: canvasX, y: 0 })) ?? [];
        return { xValue, seriesValues: elementsToSeriesValues(elements) };
      } catch (err: unknown) {
        console.error(err);
        return undefined;
      }
    },
    [coordinator, renderer],
  );

  // Both markers must be resolved and committed together in one setMarkers call - resolving them
  // separately (e.g. one setMarker call per slot) can leak an intermediate state where only one
  // slot reflects the update, which then gets rebroadcast and can stomp the other synced panel.
  //
  // Resolution is async (Worker round-trip), so a later call can finish before an earlier one -
  // remoteRequestIdRef discards any result that isn't from the most recently started call.
  const remoteRequestIdRef = useRef(0);
  const handleRemoteMarkers = useCallback(
    (markerAXValue: number | undefined, markerBXValue: number | undefined) => {
      const requestId = ++remoteRequestIdRef.current;
      void (async () => {
        const [nextMarkerA, nextMarkerB] = await Promise.all([
          resolveMarkerAtXValue(markerAXValue),
          resolveMarkerAtXValue(markerBXValue),
        ]);
        if (!isMounted() || remoteRequestIdRef.current !== requestId) {
          return;
        }

        setMarkers(nextMarkerA, nextMarkerB);
      })();
    },
    [resolveMarkerAtXValue, isMounted, setMarkers],
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
    handleCanvasClick,
  };
}

export default useDeltaMeasureMode;
