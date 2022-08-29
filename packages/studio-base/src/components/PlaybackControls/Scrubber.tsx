// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "react-use";
import { makeStyles } from "tss-react/mui";
import { v4 as uuidv4 } from "uuid";

import { subtract as subtractTimes, toSec, fromSec, Time } from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import {
  useClearHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import PlaybackBarHoverTicks from "./PlaybackBarHoverTicks";
import { ProgressPlot } from "./ProgressPlot";
import Slider from "./Slider";

const useStyles = makeStyles()((theme) => ({
  tooltipWrapper: {
    label: "Scrubber-tooltipWrapper",
    fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, "zero"`,
    fontFamily: fonts.SANS_SERIF,
    whiteSpace: "nowrap",
    gap: theme.spacing(0.5),
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    flexDirection: "column",
  },
  marker: {
    label: "Scrubber-marker",
    backgroundColor: theme.palette.text.primary,
    position: "absolute",
    height: 8,
    borderRadius: 1,
    width: 2,
    transform: "translate(-50%, 0)",
  },
  track: {
    label: "Scrubber-track",
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: theme.palette.action.focus,
  },
  trackDisabled: {
    label: "Scrubber-trackDisabled",
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
  const el = useRef<HTMLDivElement>(ReactNull);

  const { formatTime, timeFormat } = useAppTimeFormat();

  const startTime = useMessagePipeline(selectStartTime);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const endTime = useMessagePipeline(selectEndTime);
  const presence = useMessagePipeline(selectPresence);
  const ranges = useMessagePipeline(selectRanges);

  const setHoverValue = useSetHoverValue();

  const onChange = useCallback((value: number) => onSeek(fromSec(value)), [onSeek]);

  const latestStartTime = useLatest(startTime);
  const onHoverOver = useCallback(
    (x: number, value: number) => {
      if (!latestStartTime.current || el.current == undefined) {
        return;
      }
      const currentEl = el.current;
      // fix the y position of the tooltip to float on top of the playback bar
      const y = currentEl.getBoundingClientRect().top;

      const stamp = fromSec(value);
      const timeFromStart = subtractTimes(stamp, latestStartTime.current);

      const tooltipItems = [];

      switch (timeFormat) {
        case "TOD":
          tooltipItems.push({ title: "Time", value: formatTime(stamp) });
          break;
        case "SEC":
          tooltipItems.push({ title: "SEC", value: formatTime(stamp) });
          break;
      }

      tooltipItems.push({ title: "Elapsed", value: `${toSec(timeFromStart).toFixed(9)} sec` });

      const tip = (
        <div className={classes.tooltipWrapper}>
          {tooltipItems.map((item) => (
            <Fragment key={item.title}>
              <Typography align="right" variant="body2">
                {item.title}:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {item.value}
              </Typography>
            </Fragment>
          ))}
        </div>
      );
      setTooltipState({ x, y, tip });
      setHoverValue({
        componentId: hoverComponentId,
        type: "PLAYBACK_SECONDS",
        value: toSec(timeFromStart),
      });
    },
    [
      latestStartTime,
      timeFormat,
      classes.tooltipWrapper,
      setHoverValue,
      hoverComponentId,
      formatTime,
    ],
  );

  const clearHoverValue = useClearHoverValue();

  const onHoverOut = useCallback(() => {
    setTooltipState(undefined);
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

  const [tooltipState, setTooltipState] = useState<
    { x: number; y: number; tip: JSX.Element } | undefined
  >();
  const { tooltip } = useTooltip({
    contents: tooltipState?.tip,
    noPointerEvents: true,
    shown: tooltipState != undefined,
    targetPosition: {
      x: tooltipState?.x ?? 0,
      y: tooltipState?.y ?? 0,
    },
  });

  const min = startTime && toSec(startTime);
  const max = endTime && toSec(endTime);
  const value = currentTime == undefined ? undefined : toSec(currentTime);
  const step = ((max ?? 100) - (min ?? 0)) / 500;

  const loading = presence === PlayerPresence.INITIALIZING || presence === PlayerPresence.BUFFERING;

  return (
    <Stack
      direction="row"
      flexGrow={1}
      alignItems="center"
      position="relative"
      style={{ height: 28 }}
    >
      {tooltip}
      <div className={cx(classes.track, { [classes.trackDisabled]: !startTime })} />
      <Stack position="absolute" flex="auto" fullWidth style={{ height: 4 }}>
        <ProgressPlot loading={loading} availableRanges={ranges} />
      </Stack>
      <PlaybackBarHoverTicks componentId={hoverComponentId} />
      <Stack ref={el} fullHeight fullWidth position="absolute" flex={1}>
        <Slider
          min={min ?? 0}
          max={max ?? 100}
          disabled={min == undefined || max == undefined}
          step={step}
          value={value}
          onHoverOver={onHoverOver}
          onHoverOut={onHoverOut}
          onChange={onChange}
          renderSlider={renderSlider}
        />
      </Stack>
    </Stack>
  );
}
