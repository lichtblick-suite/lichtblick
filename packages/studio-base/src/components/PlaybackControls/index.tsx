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

import {
  Pause20Filled,
  Pause20Regular,
  Play20Filled,
  Play20Regular,
  Next20Filled,
  Next20Regular,
  Previous20Filled,
  Previous20Regular,
} from "@fluentui/react-icons";
import { Divider } from "@mui/material";
import { useCallback, useMemo, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { compare, Time } from "@foxglove/rostime";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import HoverableIconButton from "@foxglove/studio-base/components/HoverableIconButton";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import LoopIcon from "@foxglove/studio-base/components/LoopIcon";
import MessageOrderControls from "@foxglove/studio-base/components/MessageOrderControls";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import {
  jumpSeek,
  DIRECTION,
} from "@foxglove/studio-base/components/PlaybackControls/sharedHelpers";
import PlaybackSpeedControls from "@foxglove/studio-base/components/PlaybackSpeedControls";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";

import PlaybackTimeDisplay from "./PlaybackTimeDisplay";
import RepeatAdapter from "./RepeatAdapter";
import Scrubber from "./Scrubber";

const useStyles = makeStyles()((theme) => ({
  root: {
    label: "PlaybackControls-root",
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  buttonGroup: {
    label: "PlaybackControls-buttonGroup",
    backgroundColor: theme.palette.action.focus,
    borderRadius: theme.shape.borderRadius,

    ".MuiIconButton-root": {
      "&:not(:first-of-type)": {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      },
      "&:not(:last-of-type)": {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
      },
    },
    ".MuiDivider-root": {
      borderColor: theme.palette.background.paper,
      borderRightWidth: 2,
    },
  },
}));

export default function PlaybackControls({
  play,
  pause,
  seek,
  isPlaying,
  getTimeInfo,
}: {
  play: () => void;
  pause: () => void;
  seek: (time: Time) => void;
  isPlaying: boolean;
  getTimeInfo: () => { startTime?: Time; endTime?: Time; currentTime?: Time };
}): JSX.Element {
  const { classes } = useStyles();
  const [repeat, setRepeat] = useState(false);
  const stopAtTime = useRef<Time | undefined>(undefined);

  // See comments below in seekForwardAction for how seeking is handled
  useMessagePipeline(
    useCallback(
      (ctx) => {
        const currentTime = ctx.playerState.activeData?.currentTime;
        if (stopAtTime.current && currentTime && compare(currentTime, stopAtTime.current) >= 0) {
          stopAtTime.current = undefined;
          pause();
        }
      },
      [pause],
    ),
  );

  const resumePlay = useCallback(() => {
    const { startTime: start, endTime: end, currentTime: current } = getTimeInfo();
    // if we are at the end, we need to go back to start
    if (current && end && start && compare(current, end) >= 0) {
      // If the resume is a result of a forward seek and we are at the end, reset the stop marker
      // to the start.
      if (stopAtTime.current) {
        stopAtTime.current = start;
      }
      seek(start);
    }
    play();
  }, [getTimeInfo, play, seek]);

  const toggleRepeat = useCallback(() => {
    setRepeat((old) => !old);
  }, []);

  const togglePlayPause = useCallback(() => {
    stopAtTime.current = undefined;
    if (isPlaying) {
      pause();
    } else {
      resumePlay();
    }
  }, [pause, resumePlay, isPlaying]);

  const seekForwardAction = useCallback(
    (ev?: KeyboardEvent) => {
      const { currentTime } = getTimeInfo();
      if (!currentTime) {
        return;
      }

      // We implement forward seek by playing at least up to the desired seek time rather than
      // the "jump" seek behavior of the backwards seek.
      //
      // Playing forward at least up to the desired seek time will play all messages to the panels
      // which mirrors the behavior panels would expect when playing without stepping. This behavior
      // is important for some message types which convey state information.
      //
      // i.e. Skipping coordinate frame messages may result in incorrectly rendered markers or
      // missing markers altogther.
      stopAtTime.current = jumpSeek(DIRECTION.FORWARD, currentTime, ev);
      resumePlay();
    },
    [getTimeInfo, resumePlay],
  );

  const seekBackwardAction = useCallback(
    (ev?: KeyboardEvent) => {
      const { currentTime } = getTimeInfo();
      if (!currentTime) {
        return;
      }
      seek(jumpSeek(DIRECTION.BACKWARD, currentTime, ev));
    },
    [getTimeInfo, seek],
  );

  const keyDownHandlers = useMemo(
    () => ({
      " ": togglePlayPause,
      ArrowLeft: (ev: KeyboardEvent) => {
        seekBackwardAction(ev);
      },
      ArrowRight: (ev: KeyboardEvent) => {
        seekForwardAction(ev);
      },
    }),
    [seekBackwardAction, seekForwardAction, togglePlayPause],
  );

  const [enableMessageOrdering = false] = useAppConfigurationValue<boolean>(
    AppSetting.EXPERIMENTAL_MESSAGE_ORDER,
  );

  return (
    <>
      <RepeatAdapter
        play={play}
        pause={pause}
        seek={seek}
        repeatEnabled={repeat}
        isPlaying={isPlaying}
      />
      <KeyListener global keyDownHandlers={keyDownHandlers} />
      <Stack className={classes.root} direction="row" alignItems="center" gap={1} padding={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          {enableMessageOrdering && <MessageOrderControls />}
          <PlaybackSpeedControls />
        </Stack>
        <Stack direction="row" alignItems="center" flex={1} gap={1}>
          <Stack direction="row" alignItems="center" gap={1}>
            <HoverableIconButton
              title="Loop playback"
              color={repeat ? "primary" : "inherit"}
              onClick={toggleRepeat}
              icon={repeat ? <LoopIcon strokeWidth={1.9375} /> : <LoopIcon strokeWidth={1.375} />}
              activeIcon={<LoopIcon strokeWidth={1.875} />}
            />
            <HoverableIconButton
              title={isPlaying ? "Pause" : "Play"}
              onClick={isPlaying ? pause : resumePlay}
              icon={isPlaying ? <Pause20Regular /> : <Play20Regular />}
              activeIcon={isPlaying ? <Pause20Filled /> : <Play20Filled />}
            />
          </Stack>
          <Scrubber onSeek={seek} />
          <PlaybackTimeDisplay onSeek={seek} onPause={pause} />
        </Stack>
        <Stack direction="row" className={classes.buttonGroup}>
          <HoverableIconButton
            title="Seek backward"
            icon={<Previous20Regular />}
            activeIcon={<Previous20Filled />}
            onClick={() => seekBackwardAction()}
          />
          <Divider flexItem orientation="vertical" />
          <HoverableIconButton
            title="Seek forward"
            icon={<Next20Regular />}
            activeIcon={<Next20Filled />}
            onClick={() => seekForwardAction()}
          />
        </Stack>
      </Stack>
    </>
  );
}
