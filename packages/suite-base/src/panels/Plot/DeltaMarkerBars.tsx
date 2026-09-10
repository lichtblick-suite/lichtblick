// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLatest } from "react-use";

import { DEFAULT_MARKER_COLOR } from "@lichtblick/suite-base/panels/Plot/constants";
import { getPixelForXValue } from "@lichtblick/suite-base/panels/Plot/utils/getPixelForXValue";
import { getPixelForYValue } from "@lichtblick/suite-base/panels/Plot/utils/getPixelForYValue";
import {
  DeltaOverlay,
  DeltaOverlaySeriesLabel,
} from "@lichtblick/suite-base/panels/shared/DeltaOverlay";
import {
  computeDeltaDisplay,
  DeltaMarker,
  getDeltaSeriesConfigIndexes,
} from "@lichtblick/suite-base/panels/shared/deltaMarkers";

import { useDeltaMarkerBarsStyles } from "./DeltaMarkerBars.style";
import type { DeltaMarkerBarsProps, Scale, YScale } from "./types";

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

function setVerticalBarPosition(
  el: HTMLDivElement | null,
  pixelX: number | undefined,
  color: string,
): void {
  if (!el) {
    return;
  }
  el.style.display = pixelX == undefined ? "none" : "block";
  if (pixelX != undefined) {
    el.style.transform = `translateX(${pixelX}px)`;
  }
  el.style.borderLeftColor = color;
}

// Only needs pixelY (the line spans the full width), unlike the point/label below.
function setHorizontalBarPosition(
  el: HTMLDivElement | null,
  pixelX: number | undefined,
  pixelY: number | undefined,
  color: string,
): void {
  if (!el) {
    return;
  }
  el.style.display = pixelX == undefined || pixelY == undefined ? "none" : "block";
  if (pixelY != undefined) {
    el.style.transform = `translateY(${pixelY}px)`;
    el.style.borderTopColor = color;
  }
}

function setPointPosition(
  el: HTMLDivElement | null,
  pixelX: number | undefined,
  pixelY: number | undefined,
  color: string,
): void {
  if (!el) {
    return;
  }
  const visible = pixelX != undefined && pixelY != undefined;
  el.style.display = visible ? "block" : "none";
  if (visible) {
    el.style.transform = `translate(${pixelX}px, ${pixelY}px)`;
    el.style.backgroundColor = color;
  }
}

function setLabelPosition(
  el: HTMLDivElement | null,
  pixelX: number | undefined,
  pixelY: number | undefined,
  text: string,
): void {
  if (!el) {
    return;
  }
  const visible = pixelX != undefined && pixelY != undefined;
  el.style.display = visible ? "block" : "none";
  if (visible) {
    // Offset up and to the right of the point so the label doesn't sit on top of it.
    el.style.transform = `translate(${pixelX + 6}px, ${pixelY - 22}px)`;
    el.textContent = text;
  }
}

/**
 * Draws the two Delta/Measure-mode marker crosshairs (matching Foxglove's reference behavior: a
 * vertical + horizontal dashed line and an on-chart "P1"/"P2" label snapped to the nearest
 * series) and the DeltaOverlay table, which renders as soon as measure mode is active and fills
 * in each row as markers are placed.
 *
 * Bar/label positions are updated directly on refs (not React state) on every xScaleChanged /
 * yScaleChanged tick so panning/zooming doesn't re-render the (potentially large) overlay.
 */
// eslint-disable-next-line @typescript-eslint/no-shadow
export const DeltaMarkerBars = React.memo(function DeltaMarkerBars({
  coordinator,
  active,
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
  onClose,
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
      const primary = getPrimarySeries(marker, colorsByDatasetIndex);
      const pixelY = primary && getPixelForYValue(latestYScale.current, primary.value);
      const color = primary?.color ?? DEFAULT_MARKER_COLOR;

      setVerticalBarPosition(refs.verticalBar.current, pixelX, color);
      setHorizontalBarPosition(refs.horizontalBar.current, pixelX, pixelY, color);
      setPointPosition(refs.point.current, pixelX, pixelY, color);
      setLabelPosition(refs.label.current, pixelX, pixelY, label);
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
    if (!active) {
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

    return { delta: computeDeltaDisplay(markerA, markerB), seriesLabels };
  }, [active, colorsByDatasetIndex, labelsByDatasetIndex, markerA, markerB]);

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
      {overlayData && (
        <div className={classes.overlayWrapper} data-testid="delta-overlay-wrapper">
          <DeltaOverlay
            deltaRowLabel={deltaRowLabel}
            xColumnLabel={xColumnLabel}
            markerALabel={markerALabel}
            markerBLabel={markerBLabel}
            xValueA={markerA?.xValue}
            xValueB={markerB?.xValue}
            deltaX={overlayData.delta.deltaX}
            seriesLabels={overlayData.seriesLabels}
            series={overlayData.delta.series}
            onRemoveMarkerA={onRemoveMarkerA}
            onRemoveMarkerB={onRemoveMarkerB}
            onClose={onClose}
          />
        </div>
      )}
    </>
  );
});
