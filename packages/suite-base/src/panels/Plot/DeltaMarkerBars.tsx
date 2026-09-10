// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLatest } from "react-use";

import { getPixelForXValue } from "@lichtblick/suite-base/panels/Plot/utils/getPixelForXValue";
import { getPixelForYValue } from "@lichtblick/suite-base/panels/Plot/utils/getPixelForYValue";
import {
  DeltaOverlay,
  DeltaOverlaySeriesLabel,
} from "@lichtblick/suite-base/panels/shared/DeltaOverlay";
import {
  computeDelta,
  DeltaMarker,
  getDeltaSeriesConfigIndexes,
} from "@lichtblick/suite-base/panels/shared/deltaMarkers";

import { useDeltaMarkerBarsStyles } from "./DeltaMarkerBars.style";
import type { DeltaMarkerBarsProps, Scale, YScale } from "./types";

const DEFAULT_MARKER_COLOR = "#f44336";

/** The value+color of the series closest to where a marker was placed (used for the crosshair). */
function getPrimarySeries(
  marker: DeltaMarker | undefined,
  colorsByDatasetIndex: Record<string, string>,
): { value: number; color: string } | undefined {
  const primary = marker?.seriesValues[0];
  if (!primary || typeof primary.value !== "number") {
    return undefined;
  }
  return {
    value: primary.value,
    color: colorsByDatasetIndex[primary.configIndex] ?? DEFAULT_MARKER_COLOR,
  };
}

type MarkerRefs = {
  verticalBar: React.RefObject<HTMLDivElement>;
  horizontalBar: React.RefObject<HTMLDivElement>;
  point: React.RefObject<HTMLDivElement>;
  label: React.RefObject<HTMLDivElement>;
};

/**
 * Draws the two Delta/Measure-mode marker crosshairs (matching Foxglove's reference behavior: a
 * vertical + horizontal dashed line and an on-chart "P1"/"P2" label snapped to the nearest
 * series) and, once both are placed, the DeltaOverlay table.
 *
 * Bar/label positions are updated directly on refs (not React state) on every xScaleChanged /
 * yScaleChanged tick so panning/zooming doesn't re-render the (potentially large) overlay.
 */
// eslint-disable-next-line @typescript-eslint/no-shadow
export const DeltaMarkerBars = React.memo(function DeltaMarkerBars({
  coordinator,
  markerA,
  markerB,
  colorsByDatasetIndex,
  labelsByDatasetIndex,
  deltaRowLabel,
  xColumnLabel,
  markerALabel,
  markerBLabel,
  onRemoveMarkerA,
  onRemoveMarkerB,
}: DeltaMarkerBarsProps): React.JSX.Element {
  const { classes } = useDeltaMarkerBarsStyles();

  const latestXScale = useRef<Scale | undefined>();
  const latestYScale = useRef<YScale | undefined>();
  const latestMarkerA = useLatest(markerA);
  const latestMarkerB = useLatest(markerB);

  const markerARefs: MarkerRefs = {
    verticalBar: useRef(ReactNull),
    horizontalBar: useRef(ReactNull),
    point: useRef(ReactNull),
    label: useRef(ReactNull),
  };
  const markerBRefs: MarkerRefs = {
    verticalBar: useRef(ReactNull),
    horizontalBar: useRef(ReactNull),
    point: useRef(ReactNull),
    label: useRef(ReactNull),
  };

  const updateMarker = useCallback(
    (refs: MarkerRefs, marker: DeltaMarker | undefined, label: string) => {
      const pixelX = getPixelForXValue(latestXScale.current, marker?.xValue);
      if (refs.verticalBar.current) {
        if (pixelX == undefined) {
          refs.verticalBar.current.style.display = "none";
        } else {
          refs.verticalBar.current.style.display = "block";
          refs.verticalBar.current.style.transform = `translateX(${pixelX}px)`;
        }
      }

      const primary = getPrimarySeries(marker, colorsByDatasetIndex);
      const pixelY = primary && getPixelForYValue(latestYScale.current, primary.value);
      const color = primary?.color ?? DEFAULT_MARKER_COLOR;

      if (refs.verticalBar.current) {
        refs.verticalBar.current.style.borderLeftColor = color;
      }

      for (const ref of [refs.horizontalBar, refs.point, refs.label]) {
        if (!ref.current) {
          continue;
        }
        if (pixelX == undefined || pixelY == undefined) {
          ref.current.style.display = "none";
          continue;
        }
        ref.current.style.display = "block";
      }

      if (refs.horizontalBar.current && pixelY != undefined) {
        refs.horizontalBar.current.style.transform = `translateY(${pixelY}px)`;
        refs.horizontalBar.current.style.borderTopColor = color;
      }

      if (refs.point.current && pixelX != undefined && pixelY != undefined) {
        refs.point.current.style.transform = `translate(${pixelX}px, ${pixelY}px)`;
        refs.point.current.style.backgroundColor = color;
      }

      if (refs.label.current && pixelX != undefined && pixelY != undefined) {
        // Offset up and to the right of the point so the label doesn't sit on top of it.
        refs.label.current.style.transform = `translate(${pixelX + 6}px, ${pixelY - 22}px)`;
        refs.label.current.textContent = label;
      }
    },
    [colorsByDatasetIndex],
  );

  const updateBars = useCallback(() => {
    updateMarker(markerARefs, latestMarkerA.current, markerALabel);
    updateMarker(markerBRefs, latestMarkerB.current, markerBLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateMarker, latestMarkerA, latestMarkerB, markerALabel, markerBLabel]);

  useLayoutEffect(() => {
    updateBars();
  }, [markerA, markerB, updateBars]);

  useEffect(() => {
    latestXScale.current = undefined;
    latestYScale.current = undefined;
    if (!coordinator) {
      return;
    }
    const handleXScale = (scale: Scale | undefined) => {
      latestXScale.current = scale;
      updateBars();
    };
    const handleYScale = (scale: YScale | undefined) => {
      latestYScale.current = scale;
      updateBars();
    };
    coordinator.on("xScaleChanged", handleXScale);
    coordinator.on("yScaleChanged", handleYScale);
    return () => {
      coordinator.off("xScaleChanged", handleXScale);
      coordinator.off("yScaleChanged", handleYScale);
    };
  }, [coordinator, updateBars]);

  const overlayData = useMemo(() => {
    if (!markerA || !markerB) {
      return undefined;
    }

    const seriesLabels: DeltaOverlaySeriesLabel[] = getDeltaSeriesConfigIndexes(
      markerA,
      markerB,
    ).map(
      (configIndex): DeltaOverlaySeriesLabel => ({
        configIndex,
        label: labelsByDatasetIndex[configIndex] ?? "",
        color: colorsByDatasetIndex[configIndex] ?? "",
      }),
    );

    return { delta: computeDelta(markerA, markerB), seriesLabels };
  }, [colorsByDatasetIndex, labelsByDatasetIndex, markerA, markerB]);

  if (!coordinator) {
    return <></>;
  }

  return (
    <>
      {[
        { refs: markerARefs, testIdSuffix: "a" },
        { refs: markerBRefs, testIdSuffix: "b" },
      ].map(({ refs, testIdSuffix }) => (
        <Fragment key={testIdSuffix}>
          <div
            data-testid={`delta-marker-bar-${testIdSuffix}`}
            ref={refs.verticalBar}
            className={classes.markerBar}
          />
          <div
            data-testid={`delta-marker-horizontal-bar-${testIdSuffix}`}
            ref={refs.horizontalBar}
            className={classes.horizontalMarkerBar}
          />
          <div
            data-testid={`delta-marker-point-${testIdSuffix}`}
            ref={refs.point}
            className={classes.markerPoint}
          />
          <div
            data-testid={`delta-marker-label-${testIdSuffix}`}
            ref={refs.label}
            className={classes.markerLabel}
          />
        </Fragment>
      ))}
      {overlayData && markerA && markerB && (
        <div className={classes.overlayWrapper} data-testid="delta-overlay-wrapper">
          <DeltaOverlay
            deltaRowLabel={deltaRowLabel}
            xColumnLabel={xColumnLabel}
            markerALabel={markerALabel}
            markerBLabel={markerBLabel}
            xValueA={markerA.xValue}
            xValueB={markerB.xValue}
            deltaX={overlayData.delta.deltaX}
            seriesLabels={overlayData.seriesLabels}
            series={overlayData.delta.series}
            onRemoveMarkerA={onRemoveMarkerA}
            onRemoveMarkerB={onRemoveMarkerB}
          />
        </div>
      )}
    </>
  );
});
