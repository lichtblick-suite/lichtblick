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
import { complement } from "intervals-fn";
import { useCallback } from "react";

import AutoSizingCanvas from "@foxglove/studio-base/components/AutoSizingCanvas";
import { Progress } from "@foxglove/studio-base/players/types";

const BAR_HEIGHT = 28;
const LINE_START = 12;
const LINE_HEIGHT = 4;

type ProgressProps = {
  progress: Progress;
};

export function ProgressPlot(props: ProgressProps): JSX.Element {
  const { fullyLoadedFractionRanges } = props.progress;
  const theme = useTheme();
  const draw = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      context.clearRect(0, 0, width, height);
      if (fullyLoadedFractionRanges) {
        context.fillStyle = theme.palette.neutralLight;
        const invertedRanges = complement({ start: 0, end: 1 }, fullyLoadedFractionRanges);
        for (const range of invertedRanges) {
          const start = width * range.start;
          const end = width * range.end;
          context.fillRect(start, LINE_START, end - start, LINE_HEIGHT);
        }
      }
    },
    [fullyLoadedFractionRanges, theme.palette.neutralLight],
  );

  return (
    <div style={{ height: BAR_HEIGHT }}>
      <AutoSizingCanvas draw={draw} />
    </div>
  );
}
