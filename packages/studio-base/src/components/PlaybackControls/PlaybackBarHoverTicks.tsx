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

import { Typography } from "@mui/material";
import { useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";
import { makeStyles } from "tss-react/mui";

import { add, fromSec, toSec } from "@foxglove/rostime";
import { RpcScales } from "@foxglove/studio-base/components/Chart/types";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import HoverBar from "@foxglove/studio-base/components/TimeBasedChart/HoverBar";
import { useHoverValue } from "@foxglove/studio-base/context/HoverValueContext";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles()((theme) => ({
  tick: {
    position: "absolute",
    left: 0,
    width: 0,
    height: 0,
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    marginLeft: -5,
  },
  tickTop: {
    top: 8,
    borderTop: `5px solid ${theme.palette.warning.main}`,
  },
  tickBottom: {
    bottom: 8,
    borderBottom: `5px solid ${theme.palette.warning.main}`,
  },
  label: {
    position: "absolute",
    left: 0,
    top: 0,
    transform: "translate(-50%, -50%)",
  },
}));

function getStartTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.startTime;
}

function getEndTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.endTime;
}

type Props = {
  componentId: string;
};

export default function PlaybackBarHoverTicks(props: Props): JSX.Element {
  const { componentId } = props;
  const { classes, cx } = useStyles();

  const startTime = useMessagePipeline(getStartTime);
  const endTime = useMessagePipeline(getEndTime);
  const hoverValue = useHoverValue({ componentId, isTimestampScale: true });
  const { formatTime } = useAppTimeFormat();

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { width, ref } = useResizeDetector({
    handleHeight: false,
    refreshMode: "debounce",
    refreshRate: 0,
  });

  const hoverTimeDisplay = useMemo(() => {
    if (
      !hoverValue ||
      hoverValue.type !== "PLAYBACK_SECONDS" ||
      !startTime ||
      hoverValue.value < 0
    ) {
      return undefined;
    }
    const stamp = add(startTime, fromSec(hoverValue.value));
    return formatTime(stamp);
  }, [formatTime, hoverValue, startTime]);

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

  // Hover time is only displayed when the hover value originates from other components
  const displayHoverTime = hoverValue != undefined && hoverValue.componentId !== componentId;

  return (
    <Stack ref={ref} flex="auto">
      {scaleBounds && (
        <HoverBar componentId={componentId} scales={scaleBounds} isTimestampScale>
          {displayHoverTime && (
            <Typography
              className={classes.label}
              align="center"
              variant="caption"
              color="warning.main"
              fontFamily={fonts.MONOSPACE}
              noWrap
            >
              {hoverTimeDisplay}
            </Typography>
          )}
          <div className={cx(classes.tick, classes.tickTop)} />
          <div className={cx(classes.tick, classes.tickBottom)} />
        </HoverBar>
      )}
    </Stack>
  );
}
