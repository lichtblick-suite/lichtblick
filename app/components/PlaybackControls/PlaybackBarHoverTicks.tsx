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
import React, { useMemo, useState } from "react";
import styled, { css } from "styled-components";

import { ScaleBounds } from "../ReactChartjs/zoomAndPanHelpers";
import Dimensions from "@foxglove-studio/app/components/Dimensions";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove-studio/app/components/MessagePipeline";
import HoverBar from "@foxglove-studio/app/components/TimeBasedChart/HoverBar";
import { toSec } from "@foxglove-studio/app/util/time";

const sharedTickStyles = css`
  position: absolute;
  left: 0px;
  width: 0px;
  height: 0px;

  border-left: 5px solid transparent;
  border-right: 5px solid transparent;

  margin-left: -6px; /* -6px seems to line up better than -5px */
`;

const TopTick = styled.div`
  ${sharedTickStyles}
  top: 8px;
  border-top: 5px solid #f7be00;
`;

const BottomTick = styled.div`
  ${sharedTickStyles}
  bottom: 8px;
  border-bottom: 5px solid #f7be00;
`;

function getStartAndEndTime({ playerState: { activeData } }: MessagePipelineContext) {
  if (activeData == null) {
    return { startTime: undefined, endTime: undefined };
  }
  return { startTime: activeData.startTime, endTime: activeData.endTime };
}

type Props = {
  componentId: string;
};

export default React.memo<Props>(function PlaybackBarHoverTicks({ componentId }: Props) {
  const { startTime, endTime } = useMessagePipeline(getStartAndEndTime);
  const [width, setWidth] = useState<number | null | undefined>();

  const scaleBounds = useMemo<{ current: ReadonlyArray<ScaleBounds> | null | undefined }>(() => {
    if (width == null || startTime == null || endTime == null) {
      return { current: null };
    }
    return {
      // HoverBar takes a ref to avoid rerendering (and avoid needing to rerender) when the bounds
      // change in charts that scroll at playback speed.
      current: [
        {
          id: componentId,
          min: 0,
          max: toSec(endTime) - toSec(startTime),
          axes: "xAxes",
          minAlongAxis: 0,
          maxAlongAxis: width,
        },
      ],
    };
  }, [width, startTime, endTime, componentId]);

  return (
    <>
      <Dimensions onChange={({ width: newWidth }) => setWidth(newWidth)} />
      {scaleBounds && (
        <HoverBar componentId={componentId} scaleBounds={scaleBounds} isTimestampScale>
          <TopTick />
          <BottomTick />
        </HoverBar>
      )}
    </>
  );
});
