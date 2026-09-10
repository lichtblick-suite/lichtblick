// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Dismiss12Regular, Square12Filled } from "@fluentui/react-icons";
import { Button } from "@mui/material";
import { CSSProperties } from "react";

import { Immutable } from "@lichtblick/suite";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useDeltaOverlayStyles } from "@lichtblick/suite-base/panels/shared/DeltaOverlay.style";
import { DeltaResult } from "@lichtblick/suite-base/panels/shared/deltaMarkers";

export type DeltaOverlaySeriesLabel = {
  configIndex: number;
  label: string;
  color: string;
};

export type DeltaOverlayProps = Immutable<{
  deltaRowLabel: string;
  xColumnLabel: string;
  markerALabel: string;
  markerBLabel: string;
  xValueA: number;
  xValueB: number;
  deltaX: number;
  /** One column per series, in display order. */
  seriesLabels: DeltaOverlaySeriesLabel[];
  series: DeltaResult["series"];
  formatXValue?: (value: number) => string;
  onRemoveMarkerA: () => void;
  onRemoveMarkerB: () => void;
  style?: CSSProperties;
}>;

const MISSING_VALUE_PLACEHOLDER = "—";

// Purely presentational: panels place markers, compute values via computeDelta, and position this overlay.
// eslint-disable-next-line @typescript-eslint/no-shadow
export const DeltaOverlay = React.memo(function DeltaOverlay(
  props: DeltaOverlayProps,
): React.JSX.Element {
  const {
    deltaRowLabel,
    xColumnLabel,
    markerALabel,
    markerBLabel,
    xValueA,
    xValueB,
    deltaX,
    seriesLabels,
    series,
    formatXValue = (value) => value.toFixed(3),
    onRemoveMarkerA,
    onRemoveMarkerB,
    style,
  } = props;
  const { classes } = useDeltaOverlayStyles();

  const resultByConfigIndex = new Map(series.map((result) => [result.configIndex, result]));

  const renderSeriesValue = (
    configIndex: number,
    pick: "valueAtA" | "valueAtB" | "delta",
  ): number | string => {
    return resultByConfigIndex.get(configIndex)?.[pick] ?? MISSING_VALUE_PLACEHOLDER;
  };

  return (
    <div className={classes.root} style={style} data-testid="delta-overlay">
      <div
        className={classes.grid}
        style={{
          // One column per series, sized to fit its longest value/label.
          gridTemplateColumns: `auto max-content repeat(${seriesLabels.length}, max-content)`,
        }}
      >
        <div />
        <div className={classes.rowLabel}>{xColumnLabel}</div>
        {seriesLabels.map(({ configIndex, label, color }) => (
          <Stack key={configIndex} direction="row" alignItems="center" gap={0.5}>
            <Square12Filled className={classes.colorIcon} style={{ color }} />
            <span className={classes.rowLabel}>{label}</span>
          </Stack>
        ))}

        <div className={classes.rowLabel}>{deltaRowLabel}</div>
        <div className={classes.value}>{formatXValue(deltaX)}</div>
        {seriesLabels.map(({ configIndex }) => (
          <div className={classes.value} key={configIndex}>
            {renderSeriesValue(configIndex, "delta")}
          </div>
        ))}

        <Stack direction="row" alignItems="center" gap={0.5}>
          <Button
            className={classes.removeButton}
            size="small"
            disableRipple
            data-testid="delta-overlay-remove-marker-a"
            onClick={onRemoveMarkerA}
          >
            <Dismiss12Regular />
          </Button>
          {markerALabel}
        </Stack>
        <div className={classes.value}>{formatXValue(xValueA)}</div>
        {seriesLabels.map(({ configIndex }) => (
          <div className={classes.value} key={configIndex}>
            {renderSeriesValue(configIndex, "valueAtA")}
          </div>
        ))}

        <Stack direction="row" alignItems="center" gap={0.5}>
          <Button
            className={classes.removeButton}
            size="small"
            disableRipple
            data-testid="delta-overlay-remove-marker-b"
            onClick={onRemoveMarkerB}
          >
            <Dismiss12Regular />
          </Button>
          {markerBLabel}
        </Stack>
        <div className={classes.value}>{formatXValue(xValueB)}</div>
        {seriesLabels.map(({ configIndex }) => (
          <div className={classes.value} key={configIndex}>
            {renderSeriesValue(configIndex, "valueAtB")}
          </div>
        ))}
      </div>
    </div>
  );
});
