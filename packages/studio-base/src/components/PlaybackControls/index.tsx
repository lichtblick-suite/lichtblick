// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Stack, IButtonStyles, makeStyles, useTheme } from "@fluentui/react";
import cx from "classnames";
import { merge } from "lodash";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { Time, compare, subtract as subtractTimes, toSec, fromSec } from "@foxglove/rostime";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import HoverableIconButton from "@foxglove/studio-base/components/HoverableIconButton";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import MessageOrderControls from "@foxglove/studio-base/components/MessageOrderControls";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import PlaybackTimeDisplayMethod from "@foxglove/studio-base/components/PlaybackControls/PlaybackTimeDisplayMethod";
import Slider from "@foxglove/studio-base/components/PlaybackControls/Slider";
import {
  jumpSeek,
  DIRECTION,
} from "@foxglove/studio-base/components/PlaybackControls/sharedHelpers";
import PlaybackSpeedControls from "@foxglove/studio-base/components/PlaybackSpeedControls";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import {
  useClearHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/HoverValueContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { PlayerState } from "@foxglove/studio-base/players/types";
import { formatTime } from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import PlaybackBarHoverTicks from "./PlaybackBarHoverTicks";
import { ProgressPlot } from "./ProgressPlot";

export const useStyles = makeStyles((theme) => ({
  fullWidthBar: {
    position: "absolute",
    top: "12px",
    left: "0",
    right: "0",
    height: "4px",
    backgroundColor: theme.palette.neutralLighterAlt,
  },
  fullWidthBarActive: {
    backgroundColor: theme.palette.neutralLight,
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
    fontFamily: fonts.MONOSPACE,
    whiteSpace: "nowrap",

    "> div": {
      paddingBottom: theme.spacing.s2,

      "&:last-child": {
        paddingBottom: 0,
      },
    },
  },
  tooltipTitle: {
    color: theme.semanticColors.bodyBackground,
    width: "70px",
    textAlign: "right",
    marginRight: theme.spacing.s2,
    display: "inline-block",
  },
  tooltipValue: {
    fontFamily: fonts.MONOSPACE,
    opacity: 0.7,
  },
}));

export type PlaybackControlProps = {
  player: PlayerState;
  auxiliaryData?: unknown;
  pause: () => void;
  play: () => void;
  seek: (arg0: Time) => void;
};

export const UnconnectedPlaybackControls = memo<PlaybackControlProps>(
  (props: PlaybackControlProps) => {
    const classes = useStyles();
    const theme = useTheme();
    const el = useRef<HTMLDivElement>(ReactNull);
    const slider = useRef<Slider>(ReactNull);
    const [repeat, setRepeat] = useState(false);
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
    const { seek, pause, play, player } = props;
    const [timezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);
    const clearHoverValue = useClearHoverValue();
    const setHoverValue = useSetHoverValue();

    // playerState is unstable, and will cause callbacks to change identity every frame. They can take
    // a ref instead.
    const playerState = useRef(player);
    playerState.current = player;

    const onChange = useCallback((value: number) => seek(fromSec(value)), [seek]);

    const [hoverComponentId] = useState<string>(() => uuidv4());
    const onMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const { activeData } = playerState.current;
        if (!activeData) {
          return;
        }
        const { startTime } = activeData;
        if (el.current == undefined || slider.current == undefined) {
          return;
        }
        const currentEl = el.current;
        const currentSlider = slider.current;
        const x = e.clientX;
        // fix the y position of the tooltip to float on top of the playback bar
        const y = currentEl.getBoundingClientRect().top;

        const value = currentSlider.getValueAtMouse(e);
        const stamp = fromSec(value);
        const timeFromStart = subtractTimes(stamp, startTime);

        const tooltipItems = [
          { title: "ROS", value: formatTimeRaw(stamp) },
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
      [classes, setHoverValue, hoverComponentId],
    );

    const onMouseLeave = useCallback(() => {
      setTooltipState(undefined);
      clearHoverValue(hoverComponentId);
    }, [clearHoverValue, hoverComponentId]);

    // Clean up the hover value when we are unmounted -- important for storybook.
    useEffect(() => onMouseLeave, [onMouseLeave]);

    const { activeData, progress } = player;

    const { isPlaying, startTime, endTime, currentTime } = activeData ?? {};

    const min = startTime && toSec(startTime);
    const max = endTime && toSec(endTime);
    const value = currentTime == undefined ? undefined : toSec(currentTime);
    const step = ((max ?? 100) - (min ?? 0)) / 500;

    // repeat logic could also live in messagePipeline but since it is only triggered
    // from playback controls we've implemented it here for now - if there is demand
    // to toggle repeat from elsewhere this logic can move
    if (currentTime && endTime && compare(currentTime, endTime) >= 0) {
      // repeat
      if (startTime && repeat) {
        seek(startTime);
        // if the user turns on repeat and we are at the end, we assume they want to play from start
        // even if paused
        play();
      } else if (activeData?.isPlaying === true) {
        // no-repeat
        // pause playback to toggle pause button state
        // if the user clicks play while we are at the end, we go back to begginning
        pause();
      }
    }

    const resumePlay = useCallback(() => {
      const {
        startTime: start,
        endTime: end,
        currentTime: current,
      } = playerState.current?.activeData ?? {};
      // if we are at the end, we need to go back to start
      if (current && end && start && compare(current, end) >= 0) {
        seek(start);
      }
      play();
    }, [play, seek]);

    const toggleRepeat = useCallback(() => {
      setRepeat((old) => !old);
    }, []);

    const togglePlayPause = useCallback(() => {
      if (playerState.current?.activeData?.isPlaying === true) {
        pause();
      } else {
        resumePlay();
      }
    }, [pause, resumePlay]);

    const keyDownHandlers = useMemo(
      () => ({
        " ": togglePlayPause,
        ArrowLeft: (ev: KeyboardEvent) =>
          jumpSeek(DIRECTION.BACKWARD, { seek, player: playerState.current }, ev),
        ArrowRight: (ev: KeyboardEvent) =>
          jumpSeek(DIRECTION.FORWARD, { seek, player: playerState.current }, ev),
      }),
      [seek, togglePlayPause],
    );

    const iconButtonStyles: IButtonStyles = {
      icon: { height: 20 },
      root: {
        margin: 0, // Remove this when global.scss goes away
        color: theme.semanticColors.buttonText,
      },
      rootChecked: {
        color: theme.palette.themePrimary,
        backgroundColor: "transparent",
      },
      rootCheckedHovered: { color: theme.palette.themePrimary },
      rootHovered: { color: theme.semanticColors.buttonTextHovered },
      rootPressed: { color: theme.semanticColors.buttonTextPressed },
    };

    const seekIconButttonStyles = ({
      left = false,
      right = false,
    }: {
      left?: boolean | undefined;
      right?: boolean | undefined;
    }) =>
      ({
        root: {
          background: theme.semanticColors.buttonBackgroundHovered,
          ...(left && {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          }),
          ...(right && {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          }),
        },
        rootHovered: {
          background: theme.semanticColors.buttonBackgroundPressed,
        },
      } as IButtonStyles);

    const loopTooltip = useTooltip({ contents: "Loop playback" });
    const seekBackwardTooltip = useTooltip({ contents: "Seek backward" });
    const seekForwardTooltip = useTooltip({ contents: "Seek forward" });

    return (
      <div>
        {tooltip}
        {loopTooltip.tooltip}
        {seekBackwardTooltip.tooltip}
        {seekForwardTooltip.tooltip}
        <KeyListener global keyDownHandlers={keyDownHandlers} />
        <Stack
          horizontal
          verticalAlign="center"
          tokens={{
            childrenGap: theme.spacing.s1,
            padding: theme.spacing.s1,
          }}
        >
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: theme.spacing.s1 }}>
            <MessageOrderControls />
            <PlaybackSpeedControls />
          </Stack>
          <Stack
            horizontal
            verticalAlign="center"
            styles={{ root: { flex: 1 } }}
            tokens={{
              childrenGap: theme.spacing.s1,
              padding: `0 ${theme.spacing.s2}`,
            }}
          >
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: theme.spacing.s2 }}>
              <HoverableIconButton
                elementRef={loopTooltip.ref}
                checked={repeat}
                disabled={!activeData}
                onClick={toggleRepeat}
                iconProps={{
                  iconName: repeat ? "LoopFilled" : "Loop",
                  iconNameActive: "LoopFilled",
                }}
                styles={merge(iconButtonStyles, {
                  rootDisabled: { background: "transparent" },
                })}
              />
              <HoverableIconButton
                disabled={!activeData}
                onClick={isPlaying === true ? pause : resumePlay}
                iconProps={{
                  iconName: isPlaying === true ? "Pause" : "Play",
                  iconNameActive: isPlaying === true ? "PauseFilled" : "PlayFilled",
                }}
                styles={merge(iconButtonStyles, {
                  rootDisabled: { background: "transparent" },
                })}
              />
            </Stack>
            <Stack
              horizontal
              grow={1}
              verticalAlign="center"
              styles={{ root: { height: "28px", position: "relative" } }}
            >
              <div
                className={cx(classes.fullWidthBar, {
                  [classes.fullWidthBarActive]: activeData,
                })}
              />
              <Stack className={classes.stateBar}>
                <ProgressPlot progress={progress} />
              </Stack>
              <div
                ref={el}
                className={classes.sliderContainer}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
              >
                <Slider
                  ref={slider}
                  min={min ?? 0}
                  max={max ?? 100}
                  disabled={min == undefined || max == undefined}
                  step={step}
                  value={value}
                  draggable
                  onChange={onChange}
                  renderSlider={(val) =>
                    val == undefined ? undefined : (
                      <div
                        className={classes.marker}
                        style={{ left: `calc(${val * 100}% - 2px)` }}
                      />
                    )
                  }
                />
              </div>
              <PlaybackBarHoverTicks componentId={hoverComponentId} />
            </Stack>
            <PlaybackTimeDisplayMethod
              currentTime={currentTime}
              startTime={startTime}
              endTime={endTime}
              onSeek={seek}
              onPause={pause}
              isPlaying={isPlaying ?? false}
              timezone={timezone}
            />
          </Stack>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 2 }}>
            <HoverableIconButton
              elementRef={seekBackwardTooltip.ref}
              iconProps={{ iconName: "Previous", iconNameActive: "PreviousFilled" }}
              disabled={!activeData}
              onClick={() =>
                jumpSeek(DIRECTION.BACKWARD, {
                  seek,
                  player: playerState.current,
                })
              }
              styles={merge(seekIconButttonStyles({ left: true }), iconButtonStyles)}
            />
            <HoverableIconButton
              elementRef={seekForwardTooltip.ref}
              iconProps={{ iconName: "Next", iconNameActive: "NextFilled" }}
              disabled={!activeData}
              onClick={() =>
                jumpSeek(DIRECTION.FORWARD, {
                  seek,
                  player: playerState.current,
                })
              }
              styles={merge(seekIconButttonStyles({ right: true }), iconButtonStyles)}
            />
          </Stack>
        </Stack>
      </div>
    );
  },
);

function getPause(ctx: MessagePipelineContext) {
  return ctx.pausePlayback;
}

function getPlay(ctx: MessagePipelineContext) {
  return ctx.startPlayback;
}

function getSeek(ctx: MessagePipelineContext) {
  return ctx.seekPlayback;
}

function getPlayer(ctx: MessagePipelineContext) {
  return ctx.playerState;
}

export default function PlaybackControls(): JSX.Element {
  const pause = useMessagePipeline(getPause);
  const play = useMessagePipeline(getPlay);
  const seek = useMessagePipeline(getSeek);
  const player = useMessagePipeline(getPlayer);

  return <UnconnectedPlaybackControls pause={pause} seek={seek} play={play} player={player} />;
}
