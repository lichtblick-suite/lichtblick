// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Tooltip } from "@mui/material";
import { useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";
import { makeStyles } from "tss-react/mui";

import { add, fromSec, toSec } from "@lichtblick/rostime";
import { RpcScales } from "@lichtblick/suite-base/components/Chart/types";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import Stack from "@lichtblick/suite-base/components/Stack";
import HoverBar from "@lichtblick/suite-base/components/TimeBasedChart/HoverBar";
import { useHoverValue } from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import { useAppTimeFormat } from "@lichtblick/suite-base/hooks";
import { customTypography } from "@lichtblick/theme";

const useStyles = makeStyles()((theme) => ({
  tick: {
    position: "absolute",
    height: 16,
    borderRadius: 1,
    width: 2,
    top: 8,
    transform: "translate(-50%, 0)",
    backgroundColor: theme.palette.warning.main,
  },
  time: {
    textAlign: "center",
    fontFamily: customTypography.fontMonospace,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    letterSpacing: theme.typography.caption.letterSpacing,
    whiteSpace: "nowrap",
  },
  tooltip: {
    '&[data-popper-placement*="top"] .MuiTooltip-tooltip': {
      marginBottom: `${theme.spacing(1)} !important`,
    },
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

export default function PlaybackBarHoverTicks(props: Props): React.JSX.Element {
  const { componentId } = props;
  const { classes } = useStyles();

  const startTime = useMessagePipeline(getStartTime);
  const endTime = useMessagePipeline(getEndTime);
  const hoverValue = useHoverValue({ componentId, isPlaybackSeconds: true });
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
    if (hoverValue?.type !== "PLAYBACK_SECONDS" || !startTime || hoverValue.value < 0) {
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
        <HoverBar componentId={componentId} scales={scaleBounds} isPlaybackSeconds>
          <Tooltip
            arrow
            classes={{ popper: classes.tooltip }}
            placement="top"
            disableFocusListener
            disableHoverListener
            disableTouchListener
            disableInteractive
            slotProps={{ transition: { timeout: 0 } }}
            open={displayHoverTime}
            title={<div className={classes.time}>{hoverTimeDisplay}</div>}
          >
            <div className={classes.tick} />
          </Tooltip>
        </HoverBar>
      )}
    </Stack>
  );
}
