// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import CloseIcon from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";
import React, { type CSSProperties, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Immutable } from "@lichtblick/suite";
import { useDeltaOverlayStyles } from "@lichtblick/suite-base/panels/shared/DeltaOverlay.style";
import { MISSING_VALUE_PLACEHOLDER } from "@lichtblick/suite-base/panels/shared/constants";
import { DeltaResult } from "@lichtblick/suite-base/panels/shared/types";

export type DeltaOverlaySeriesLabel = {
  configIndex: number;
  label: string;
};

export type DeltaOverlayProps = Immutable<{
  deltaRowLabel: string;
  xColumnLabel: string;
  yColumnLabel: string;
  markerALabel: string;
  markerBLabel: string;
  markerAColor?: string;
  markerBColor?: string;
  xValueA: number | undefined;
  xValueB: number | undefined;
  yValueA?: number | string;
  yValueB?: number | string;
  deltaX: number | undefined;
  deltaY?: number;
  seriesLabels?: DeltaOverlaySeriesLabel[];
  series?: DeltaResult["series"];
  formatXValue?: (value: number) => string;
  formatYValue?: (value: number) => string;
  onRemoveMarkerA: () => void;
  onRemoveMarkerB: () => void;
  style?: CSSProperties;
}>;

// Purely presentational: panels place markers, compute values via computeDelta, and position this overlay.
// eslint-disable-next-line @typescript-eslint/no-shadow
export const DeltaOverlay = React.memo(function DeltaOverlay(
  props: DeltaOverlayProps,
): React.JSX.Element {
  const {
    deltaRowLabel,
    xColumnLabel,
    yColumnLabel,
    markerALabel,
    markerBLabel,
    markerAColor,
    markerBColor,
    xValueA,
    xValueB,
    yValueA,
    yValueB,
    deltaX,
    deltaY,
    formatXValue = (value) => value.toFixed(6),
    formatYValue = (value) => value.toFixed(6),
    onRemoveMarkerA,
    onRemoveMarkerB,
    style,
  } = props;
  const { t } = useTranslation("plot");
  const { classes } = useDeltaOverlayStyles();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }>();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef(position);

  const renderFormattedX = (value: number | undefined): string =>
    value != undefined ? formatXValue(value) : MISSING_VALUE_PLACEHOLDER;

  const renderFormattedY = (value: number | string | undefined): string => {
    if (value == undefined) {
      return MISSING_VALUE_PLACEHOLDER;
    }
    if (typeof value === "number") {
      return formatYValue(value);
    }
    return value;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest("[data-delta-overlay-action]")) {
      return;
    }

    const overlay = overlayRef.current;
    const container = overlay?.parentElement?.offsetParent as HTMLElement | null;
    if (!overlay || !container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const { x, y } = positionRef.current;

    overlay.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x,
      y,
      minX: containerRect.left - overlayRect.left + x,
      maxX: containerRect.right - overlayRect.right + x,
      minY: containerRect.top - overlayRect.top + y,
      maxY: containerRect.bottom - overlayRect.bottom + y,
    };
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    const overlay = overlayRef.current;
    if (drag?.pointerId !== event.pointerId || !overlay) {
      return;
    }

    const movementX = event.clientX - drag.startX;
    const movementY = event.clientY - drag.startY;

    const nextPosition = {
      x: Math.min(Math.max(drag.x + movementX, drag.minX), drag.maxX),
      y: Math.min(Math.max(drag.y + movementY, drag.minY), drag.maxY),
    };
    positionRef.current = nextPosition;
    overlay.style.transform = `translate(${nextPosition.x}px, ${nextPosition.y}px)`;
    event.preventDefault();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    overlayRef.current?.releasePointerCapture(event.pointerId);
    setPosition(positionRef.current);
    dragRef.current = undefined;
  };

  return (
    <div
      ref={overlayRef}
      className={classes.root}
      style={{ ...style, transform: `translate(${position.x}px, ${position.y}px)` }}
      data-testid="delta-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className={classes.grid}>
        <div />
        <div />
        <div className={classes.columnHeader}>{xColumnLabel}</div>
        <div className={classes.columnHeader}>{yColumnLabel}</div>

        <div />
        <div className={classes.rowLabel}>{deltaRowLabel}</div>
        <div className={classes.value}>{renderFormattedX(deltaX)}</div>
        <div className={classes.value}>{renderFormattedY(deltaY)}</div>

        {xValueA != undefined ? (
          <IconButton
            className={classes.removeButton}
            size="small"
            disableRipple
            data-testid="delta-overlay-remove-marker-a"
            data-delta-overlay-action
            aria-label={t("removeMarkerA")}
            title={t("removeMarkerA")}
            onClick={onRemoveMarkerA}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : (
          <div />
        )}
        <div className={classes.markerLabelCell}>
          {markerAColor && (
            <span
              className={classes.markerDot}
              style={{ backgroundColor: markerAColor }}
              data-testid="delta-overlay-dot-a"
            />
          )}
          <span className={classes.rowLabel}>{markerALabel}</span>
        </div>
        <div className={classes.value}>{renderFormattedX(xValueA)}</div>
        <div className={classes.value}>{renderFormattedY(yValueA)}</div>

        {xValueB != undefined ? (
          <IconButton
            className={classes.removeButton}
            size="small"
            disableRipple
            data-testid="delta-overlay-remove-marker-b"
            data-delta-overlay-action
            aria-label={t("removeMarkerB")}
            title={t("removeMarkerB")}
            onClick={onRemoveMarkerB}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : (
          <div />
        )}
        <div className={classes.markerLabelCell}>
          {markerBColor && (
            <span
              className={classes.markerDot}
              style={{ backgroundColor: markerBColor }}
              data-testid="delta-overlay-dot-b"
            />
          )}
          <span className={classes.rowLabel}>{markerBLabel}</span>
        </div>
        <div className={classes.value}>{renderFormattedX(xValueB)}</div>
        <div className={classes.value}>{renderFormattedY(yValueB)}</div>
      </div>
    </div>
  );
});
