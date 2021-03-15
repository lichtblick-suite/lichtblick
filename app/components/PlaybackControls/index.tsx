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

import PauseIcon from "@mdi/svg/svg/pause.svg";
import PlayIcon from "@mdi/svg/svg/play.svg";
import SkipNextOutlineIcon from "@mdi/svg/svg/skip-next-outline.svg";
import SkipPreviousOutlineIcon from "@mdi/svg/svg/skip-previous-outline.svg";
import classnames from "classnames";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Time } from "rosbag";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";

import PlaybackBarHoverTicks from "./PlaybackBarHoverTicks";
import { ProgressPlot } from "./ProgressPlot";
import styles from "./index.module.scss";
import { clearHoverValue, setHoverValue } from "@foxglove-studio/app/actions/hoverValue";
import Button from "@foxglove-studio/app/components/Button";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import KeyListener from "@foxglove-studio/app/components/KeyListener";
import MessageOrderControls from "@foxglove-studio/app/components/MessageOrderControls";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove-studio/app/components/MessagePipeline";
import PlaybackTimeDisplayMethod from "@foxglove-studio/app/components/PlaybackControls/PlaybackTimeDisplayMethod";
import {
  togglePlayPause,
  jumpSeek,
  DIRECTION,
} from "@foxglove-studio/app/components/PlaybackControls/sharedHelpers";
import PlaybackSpeedControls from "@foxglove-studio/app/components/PlaybackSpeedControls";
import Slider from "@foxglove-studio/app/components/Slider";
import tooltipStyles from "@foxglove-studio/app/components/Tooltip.module.scss";
import Tooltip from "@foxglove-studio/app/components/TooltipBase";
import { PlayerState, PlayerStateActiveData } from "@foxglove-studio/app/players/types";
import colors from "@foxglove-studio/app/styles/colors.module.scss";
import { formatTime } from "@foxglove-studio/app/util/formatTime";
import { colors as sharedColors } from "@foxglove-studio/app/util/sharedStyleConstants";
import { subtractTimes, toSec, fromSec, formatTimeRaw } from "@foxglove-studio/app/util/time";

const cx = classnames.bind(styles);

export const StyledFullWidthBar = styled.div<{ activeData?: PlayerStateActiveData }>`
  position: absolute;
  top: 12px;
  left: 0;
  right: 0;
  background-color: ${(props) => (props.activeData ? sharedColors.DARK8 : sharedColors.DARK5)};
  height: 4px;
`;

export const StyledMarker = styled.div.attrs<{ width: number }>(({ width }) => ({
  style: { left: `calc(${(width || 0) * 100}% - 2px)` },
}))<{ width: number }>`
  background-color: white;
  position: absolute;
  height: 36%;
  border: 1px solid ${colors.divider};
  width: 2px;
  top: 32%;
`;

export type PlaybackControlProps = {
  player: PlayerState;
  auxiliaryData?: any;
  pause: () => void;
  play: () => void;
  seek: (arg0: Time) => void;
};

export const TooltipItem = ({ title, value }: { title: string; value: any }) => (
  <div>
    <span className={styles.tipTitle}>{title}:</span>
    <span className={styles.tipValue}>{value}</span>
  </div>
);

export const UnconnectedPlaybackControls = memo<PlaybackControlProps>(
  (props: PlaybackControlProps) => {
    const el = useRef<HTMLDivElement | null>(null);
    const slider = useRef<Slider | null>(null);
    const { seek, pause, play, player } = props;

    // playerState is unstable, and will cause callbacks to change identity every frame. They can take
    // a ref instead.
    const playerState = useRef(player);
    playerState.current = player;

    const onChange = useCallback((value: number) => seek(fromSec(value)), [seek]);

    const keyDownHandlers = useMemo(
      () => ({
        " ": () => togglePlayPause({ pause, play, player: playerState.current }),
        ArrowLeft: (ev: KeyboardEvent) =>
          jumpSeek(DIRECTION.BACKWARD, { seek, player: playerState.current }, ev),
        ArrowRight: (ev: KeyboardEvent) =>
          jumpSeek(DIRECTION.FORWARD, { seek, player: playerState.current }, ev),
      }),
      [pause, play, seek],
    );

    const [hoverComponentId] = useState<string>(() => uuidv4());
    const dispatch = useDispatch();
    const onMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const { activeData } = playerState.current;
        if (!activeData) {
          return;
        }
        const { startTime, endTime } = activeData || {};
        if (!startTime || !endTime || el.current == undefined || slider.current == undefined) {
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

        const tip = (
          <div className={classnames(tooltipStyles.tooltip, styles.tip)}>
            <TooltipItem title="ROS" value={formatTimeRaw(stamp)} />
            <TooltipItem title="Time" value={formatTime(stamp)} />
            <TooltipItem title="Elapsed" value={`${toSec(timeFromStart).toFixed(9)} sec`} />
          </div>
        );
        Tooltip.show(x, y, tip, {
          placement: "top",
          offset: { x: 0, y: 0 },
          arrow: <div className={tooltipStyles.arrow} />,
        });
        dispatch(
          setHoverValue({
            componentId: hoverComponentId,
            type: "PLAYBACK_SECONDS",
            value: toSec(timeFromStart),
          }),
        );
      },
      [playerState, dispatch, hoverComponentId],
    );

    const onMouseLeave = useCallback(() => {
      Tooltip.hide();
      dispatch(clearHoverValue({ componentId: hoverComponentId }));
    }, [dispatch, hoverComponentId]);

    // Clean up the tooltip when we are unmounted -- important for storybook.
    useEffect(() => onMouseLeave, [onMouseLeave]);

    const { activeData, progress } = player;
    const { isPlaying, startTime, endTime, currentTime } = activeData ?? {};

    const min = (startTime && toSec(startTime)) ?? 0;
    const max = (endTime && toSec(endTime)) ?? 0;
    const value = currentTime == undefined ? undefined : toSec(currentTime);
    const step = (max - min) / 500;

    const seekControls = useMemo(
      () => (
        <>
          <Button
            onClick={() => jumpSeek(DIRECTION.BACKWARD, { seek, player: playerState.current })}
            style={{ borderRadius: "4px 0px 0px 4px", marginLeft: "16px", marginRight: "1px" }}
            className={cx([styles.seekBtn, { [styles.inactive]: !activeData }])}
          >
            <Icon medium tooltip="Seek backward">
              <SkipPreviousOutlineIcon />
            </Icon>
          </Button>
          <Button
            onClick={() => jumpSeek(DIRECTION.FORWARD, { seek, player: playerState.current })}
            style={{ borderRadius: "0px 4px 4px 0px" }}
            className={cx([styles.seekBtn, { [styles.inactive]: !activeData }])}
          >
            <Icon medium tooltip="Seek forward">
              <SkipNextOutlineIcon />
            </Icon>
          </Button>
        </>
      ),
      [activeData, seek],
    );

    return (
      <Flex row className={styles.container}>
        <KeyListener global keyDownHandlers={keyDownHandlers} />
        <MessageOrderControls />
        <PlaybackSpeedControls />
        <div className={styles.playIconWrapper} onClick={isPlaying ? pause : play}>
          <Icon style={activeData ? {} : { opacity: 0.4 }} xlarge>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Icon>
        </div>
        <div className={styles.bar}>
          <StyledFullWidthBar activeData={activeData} />
          <div className={styles.stateBar}>
            <ProgressPlot progress={progress} />
          </div>
          <div
            ref={el}
            className={styles.sliderContainer}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
          >
            <Slider
              ref={slider}
              min={min || 0}
              max={max || 100}
              disabled={min == undefined || max == undefined}
              step={step}
              value={value}
              draggable
              onChange={onChange}
              renderSlider={(val) => (val == undefined ? null : <StyledMarker width={val} />)}
            />
          </div>
          <PlaybackBarHoverTicks componentId={hoverComponentId} />
        </div>
        <PlaybackTimeDisplayMethod
          currentTime={currentTime as any}
          startTime={startTime as any}
          endTime={endTime as any}
          onSeek={seek}
          onPause={pause}
          isPlaying={isPlaying ?? false}
        />
        {seekControls}
      </Flex>
    );
  },
);

const getProps = ({
  pausePlayback,
  seekPlayback,
  startPlayback,
  playerState,
}: MessagePipelineContext) => ({
  pause: pausePlayback,
  seek: seekPlayback,
  play: startPlayback,
  player: playerState,
});

export default function PlaybackControls() {
  return <UnconnectedPlaybackControls {...useMessagePipeline(getProps)} />;
}
