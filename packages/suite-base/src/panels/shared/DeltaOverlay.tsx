// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import CloseIcon from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";
import React, { type CSSProperties } from "react";
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
  /** Undefined until that marker is placed - rendered as a placeholder. */
  xValueA: number | undefined;
  xValueB: number | undefined;
  yValueA?: number | string;
  yValueB?: number | string;
  deltaX: number | undefined;
  deltaY?: number;
  /** Preserved for backward-compatibility if passed. */
  seriesLabels?: DeltaOverlaySeriesLabel[];
  series?: DeltaResult["series"];
  formatXValue?: (value: number) => string;
  formatYValue?: (value: number) => string;
  onRemoveMarkerA: () => void;
  onRemoveMarkerB: () => void;
  /** Closes the overlay entirely and deactivates measure mode. */
  onClose: () => void;
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
    onClose,
    style,
  } = props;
  const { t } = useTranslation("plot");
  const { classes } = useDeltaOverlayStyles();

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

  return (
    <div className={classes.root} style={style} data-testid="delta-overlay">
      <IconButton
        className={classes.closeButton}
        size="small"
        disableRipple
        data-testid="delta-overlay-close"
        aria-label={t("closeMeasureMode")}
        onClick={onClose}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
      <div className={classes.grid}>
        <div />
        <div className={classes.columnHeader}>{xColumnLabel}</div>
        <div className={classes.columnHeader}>{yColumnLabel}</div>
        <div />

        <div className={classes.rowLabel}>{deltaRowLabel}</div>
        <div className={classes.value}>{renderFormattedX(deltaX)}</div>
        <div className={classes.value}>{renderFormattedY(deltaY)}</div>
        <div />

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
        {xValueA != undefined ? (
          <IconButton
            className={classes.removeButton}
            size="small"
            disableRipple
            data-testid="delta-overlay-remove-marker-a"
            aria-label={t("removeMarkerA")}
            onClick={onRemoveMarkerA}
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
        {xValueB != undefined ? (
          <IconButton
            className={classes.removeButton}
            size="small"
            disableRipple
            data-testid="delta-overlay-remove-marker-b"
            aria-label={t("removeMarkerB")}
            onClick={onRemoveMarkerB}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
});
