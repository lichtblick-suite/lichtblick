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
import { useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";
import styled, { css } from "styled-components";

import { toSec } from "@foxglove/rostime";
import { RpcScales } from "@foxglove/studio-base/components/Chart/types";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import HoverBar from "@foxglove/studio-base/components/TimeBasedChart/HoverBar";

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

function getStartTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.startTime;
}

function getEndTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.endTime;
}

type Props = {
  componentId: string;
};

export default function PlaybackBarHoverTicks({ componentId }: Props): JSX.Element {
  const startTime = useMessagePipeline(getStartTime);
  const endTime = useMessagePipeline(getEndTime);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // and existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { width, ref } = useResizeDetector({
    handleHeight: false,
    refreshMode: "debounce",
    refreshRate: 0,
  });

  const scaleBounds = useMemo<RpcScales | undefined>(() => {
    if (startTime == undefined || endTime == undefined) {
      return;
    }

    return {
      x: {
        min: 0,
        max: toSec(endTime) - toSec(startTime),
        pixelMin: 0,
        pixelMax: width ?? 0,
      },
    };
  }, [width, startTime, endTime]);
  return (
    <div ref={ref} style={{ width: "100%" }}>
      {scaleBounds && (
        <HoverBar componentId={componentId} scales={scaleBounds} isTimestampScale>
          <TopTick />
          <BottomTick />
        </HoverBar>
      )}
    </div>
  );
}
