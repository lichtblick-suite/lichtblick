// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Fade, Tooltip } from "@mui/material";
import type { Instance } from "@popperjs/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "react-use";
import { makeStyles } from "tss-react/mui";
import { v4 as uuidv4 } from "uuid";

import {
  subtract as subtractTimes,
  add as addTimes,
  toSec,
  fromSec,
  Time,
} from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  useClearHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

import { EventsOverlay } from "./EventsOverlay";
import PlaybackBarHoverTicks from "./PlaybackBarHoverTicks";
import { PlaybackControlsTooltipContent } from "./PlaybackControlsTooltipContent";
import { ProgressPlot } from "./ProgressPlot";
import Slider from "./Slider";

const useStyles = makeStyles()((theme) => ({
  marker: {
    backgroundColor: theme.palette.text.primary,
    position: "absolute",
    height: 16,
    borderRadius: 1,
    width: 2,
    transform: "translate(-50%, 0)",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: theme.palette.action.focus,
  },
  trackDisabled: {
    opacity: theme.palette.action.disabledOpacity,
  },
}));

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;
const selectRanges = (ctx: MessagePipelineContext) =>
  ctx.playerState.progress.fullyLoadedFractionRanges;
const selectPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;

type Props = {
  onSeek: (seekTo: Time) => void;
};

export default function Scrubber(props: Props): JSX.Element {
  const { onSeek } = props;
  const { classes, cx } = useStyles();

  const [hoverComponentId] = useState<string>(() => uuidv4());
  const hoverElRef = useRef<HTMLDivElement>(ReactNull);

  const startTime = useMessagePipeline(selectStartTime);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const endTime = useMessagePipeline(selectEndTime);
  const presence = useMessagePipeline(selectPresence);
  const ranges = useMessagePipeline(selectRanges);

  const setHoverValue = useSetHoverValue();

  const [hoverStamp, setHoverStamp] = useState<Time | undefined>();

  const latestStartTime = useLatest(startTime);
  const latestEndTime = useLatest(endTime);

  const onChange = useCallback(
    (fraction: number) => {
      if (!latestStartTime.current || !latestEndTime.current) {
        return;
      }
      onSeek(
        addTimes(
          latestStartTime.current,
          fromSec(fraction * toSec(subtractTimes(latestEndTime.current, latestStartTime.current))),
        ),
      );
    },
    [onSeek, latestEndTime, latestStartTime],
  );

  const onHoverOver = useCallback(
    (fraction: number) => {
      if (!latestStartTime.current || !latestEndTime.current || hoverElRef.current == undefined) {
        return;
      }
      const duration = toSec(subtractTimes(latestEndTime.current, latestStartTime.current));
      const timeFromStart = fromSec(fraction * duration);
      setHoverStamp(addTimes(latestStartTime.current, timeFromStart));
      setHoverValue({
        componentId: hoverComponentId,
        type: "PLAYBACK_SECONDS",
        value: toSec(timeFromStart),
      });
    },
    [hoverComponentId, latestEndTime, latestStartTime, setHoverValue],
  );

  const clearHoverValue = useClearHoverValue();

  const onHoverOut = useCallback(() => {
    clearHoverValue(hoverComponentId);
  }, [clearHoverValue, hoverComponentId]);

  // Clean up the hover value when we are unmounted -- important for storybook.
  useEffect(() => onHoverOut, [onHoverOut]);

  const renderSlider = useCallback(
    (val?: number) => {
      if (val == undefined) {
        return undefined;
      }
      return <div className={classes.marker} style={{ left: `${val * 100}%` }} />;
    },
    [classes.marker],
  );

  const min = startTime && toSec(startTime);
  const max = endTime && toSec(endTime);
  const fraction =
    currentTime && startTime && endTime
      ? toSec(subtractTimes(currentTime, startTime)) / toSec(subtractTimes(endTime, startTime))
      : undefined;

  const loading = presence === PlayerPresence.INITIALIZING || presence === PlayerPresence.BUFFERING;

  const popperRef = React.useRef<Instance>(ReactNull);

  const positionRef = React.useRef({ x: 0, y: 0 });

  const handlePointerMove = (event: React.PointerEvent) => {
    positionRef.current = { x: event.clientX, y: event.clientY };

    if (popperRef.current != undefined) {
      void popperRef.current.update();
    }
  };

  return (
    <Tooltip
      title={hoverStamp != undefined ? <PlaybackControlsTooltipContent stamp={hoverStamp} /> : ""}
      placement="top"
      disableInteractive
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 0 }}
      PopperProps={{
        popperRef,
        modifiers: [
          {
            name: "computeStyles",
            options: {
              gpuAcceleration: false, // Fixes hairline seam on arrow in chrome.
            },
          },
          {
            name: "offset",
            options: {
              // Offset popper to hug the track better.
              offset: [0, -12],
            },
          },
        ],
        anchorEl: {
          getBoundingClientRect: () => {
            return new DOMRect(
              positionRef.current.x,
              hoverElRef.current?.getBoundingClientRect().y ?? 0,
              0,
              0,
            );
          },
        },
      }}
    >
      <Stack
        ref={hoverElRef}
        direction="row"
        flexGrow={1}
        onPointerMove={handlePointerMove}
        alignItems="center"
        position="relative"
        style={{ height: 32 }}
      >
        <div className={cx(classes.track, { [classes.trackDisabled]: !startTime })} />
        <Stack position="absolute" flex="auto" fullWidth style={{ height: 6 }}>
          <ProgressPlot loading={loading} availableRanges={ranges} />
        </Stack>
        <Stack fullHeight fullWidth position="absolute" flex={1}>
          <Slider
            disabled={min == undefined || max == undefined}
            fraction={fraction}
            onHoverOver={onHoverOver}
            onHoverOut={onHoverOut}
            onChange={onChange}
            renderSlider={renderSlider}
          />
        </Stack>
        <EventsOverlay />
        <PlaybackBarHoverTicks componentId={hoverComponentId} />
      </Stack>
    </Tooltip>
  );
}
