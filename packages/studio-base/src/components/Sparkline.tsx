// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useTheme } from "@fluentui/react";
import { useCallback } from "react";

import AutoSizingCanvas from "@foxglove/studio-base/components/AutoSizingCanvas";

export type SparklinePoint = { value: number; timestamp: number };

type SparklineProps = {
  points: SparklinePoint[];
  width: number;
  height: number;
  timeRange: number;
  maximum?: number;
  nowStamp?: number; // Mostly for testing.
};

function draw(
  points: SparklinePoint[],
  maximum: number,
  timeRange: number,
  nowStamp: number,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
) {
  const maxValue = Math.max(maximum, ...points.map(({ value }) => value));
  context.clearRect(0, 0, width, height);
  context.beginPath();
  context.strokeStyle = color;
  let first = true;
  for (const { value, timestamp } of points) {
    const x = ((timeRange + timestamp - nowStamp) / timeRange) * width;
    const y = (1 - value / maxValue) * height;
    if (first) {
      context.moveTo(x, y);
      first = false;
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

export function Sparkline(props: SparklineProps): JSX.Element {
  const theme = useTheme();
  const drawCallback = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      draw(
        props.points,
        props.maximum ?? 0,
        props.timeRange,
        props.nowStamp ?? Date.now(),
        context,
        width,
        height,
        theme.palette.neutralDark,
      );
    },
    [props.maximum, props.nowStamp, props.points, props.timeRange, theme.palette.neutralDark],
  );
  return (
    <div
      style={{
        display: "inline-block",
        verticalAlign: "-10px",
        backgroundColor: theme.palette.neutralLight,
        width: props.width,
        height: props.height,
      }}
    >
      <AutoSizingCanvas draw={drawCallback} />
    </div>
  );
}
