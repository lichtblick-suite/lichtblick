// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, makeStyles } from "@fluentui/react";
import cx from "classnames";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "react-use";
import { v4 as uuidv4 } from "uuid";

import { subtract as subtractTimes, toSec, fromSec, Time } from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import {
  useClearHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/HoverValueContext";
import { formatTime } from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import PlaybackBarHoverTicks from "./PlaybackBarHoverTicks";
import { ProgressPlot } from "./ProgressPlot";
import Slider from "./Slider";

const useStyles = makeStyles((theme) => ({
  fullWidthBar: {
    position: "absolute",
    top: "12px",
    left: "0",
    right: "0",
    height: "4px",
    backgroundColor: theme.palette.neutralLighterAlt,
  },
  fullWidthBarActive: {
    backgroundColor: theme.palette.neutralQuaternary,
  },
  marker: {
    backgroundColor: "white",
    position: "absolute",
    height: "36%",
    border: `1px solid ${theme.semanticColors.bodyText}`,
    width: "2px",
    top: "32%",
  },
  sliderContainer: {
    position: "absolute",
    zIndex: "2",
    flex: "1",
    width: "100%",
    height: "100%",
  },
  stateBar: {
    position: "absolute",
    zIndex: 1,
    flex: 1,
    width: "100%",
    height: "100%",

    "& canvas": {
      minWidth: "100%",
      minHeight: "100%",
      flex: "1 0 100%",
    },
  },
  tooltip: {
    fontFamily: fonts.SANS_SERIF,
    whiteSpace: "nowrap",

    "> div": {
      paddingBottom: theme.spacing.s2,

      "&:last-child": {
        paddingBottom: 0,
      },
    },
  },
  tooltipTitle: {
    width: "70px",
    textAlign: "right",
    marginRight: theme.spacing.s2,
    display: "inline-block",
  },
  tooltipValue: {
    fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, "zero"`,
    opacity: 0.7,
  },
}));

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;
const selectProgress = (ctx: MessagePipelineContext) => ctx.playerState.progress;

type Props = {
  onSeek: (seekTo: Time) => void;
};

export default function Scrubber(props: Props): JSX.Element {
  const { onSeek } = props;

  const [hoverComponentId] = useState<string>(() => uuidv4());
  const el = useRef<HTMLDivElement>(ReactNull);

  const startTime = useMessagePipeline(selectStartTime);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const endTime = useMessagePipeline(selectEndTime);

  const progress = useMessagePipeline(selectProgress);

  const classes = useStyles();
  const setHoverValue = useSetHoverValue();

  const onChange = useCallback((value: number) => onSeek(fromSec(value)), [onSeek]);

  const latestStartTime = useLatest(startTime);
  const onHoverOver = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>, value: number) => {
      if (!latestStartTime.current || el.current == undefined) {
        return;
      }
      const currentEl = el.current;
      const x = ev.clientX;
      // fix the y position of the tooltip to float on top of the playback bar
      const y = currentEl.getBoundingClientRect().top;

      const stamp = fromSec(value);
      const timeFromStart = subtractTimes(stamp, latestStartTime.current);

      const tooltipItems = [
        { title: "SEC", value: formatTimeRaw(stamp) },
        { title: "Time", value: formatTime(stamp) },
        { title: "Elapsed", value: `${toSec(timeFromStart).toFixed(9)} sec` },
      ];

      const tip = (
        <div className={classes.tooltip}>
          {tooltipItems.map((item) => (
            <div key={item.title}>
              <span className={classes.tooltipTitle}>{item.title}:</span>
              <span className={classes.tooltipValue}>{item.value}</span>
            </div>
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
    [latestStartTime, classes, setHoverValue, hoverComponentId],
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
      return <div className={classes.marker} style={{ left: `calc(${val * 100}% - 2px)` }} />;
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

  return (
    <>
      {tooltip}
      <div
        className={cx(classes.fullWidthBar, {
          [classes.fullWidthBarActive]: startTime,
        })}
      />
      <Stack className={classes.stateBar}>
        <ProgressPlot progress={progress} />
      </Stack>
      <div ref={el} className={classes.sliderContainer}>
        <Slider
          min={min ?? 0}
          max={max ?? 100}
          disabled={min == undefined || max == undefined}
          step={step}
          value={value}
          draggable
          onHoverOver={onHoverOver}
          onHoverOut={onHoverOut}
          onChange={onChange}
          renderSlider={renderSlider}
        />
      </div>
      <PlaybackBarHoverTicks componentId={hoverComponentId} />
    </>
  );
}
