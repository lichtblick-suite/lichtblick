// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback } from "react";

import { Time } from "@lichtblick/rostime";
import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import {
  DIRECTION,
  jumpSeek,
} from "@lichtblick/suite-base/components/PlaybackControls/sharedHelpers";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";
import { Player } from "@lichtblick/suite-base/players/types";
import BroadcastManager from "@lichtblick/suite-base/util/broadcast/BroadcastManager";

type UseDirectionalSeek = {
  seekForwardAction: (ev?: KeyboardEvent) => void;
  seekBackwardAction: (ev?: KeyboardEvent) => void;
};

type UseDirectionalSeekProps = {
  seek: NonNullable<Player["seekPlayback"]>;
  playUntil?: Player["playUntil"];
  getTimeInfo: () => { startTime?: Time; endTime?: Time; currentTime?: Time };
};

export function useDirectionalSeek({
  seek,
  getTimeInfo,
  playUntil,
}: UseDirectionalSeekProps): UseDirectionalSeek {
  const [defaultStepSize] = useAppConfigurationValue<number>(AppSetting.DEFAULT_STEP_SIZE);

  const seekForwardAction = useCallback(
    (ev?: KeyboardEvent) => {
      const { currentTime } = getTimeInfo();
      if (!currentTime) {
        return;
      }

      // If playUntil is available, we prefer to use that rather than seek, which performs a jump
      // seek.
      //
      // Playing forward up to the desired seek time will play all messages to the panels which
      // mirrors the behavior panels would expect when playing without stepping. This behavior is
      // important for some message types which convey state information.
      //
      // i.e. Skipping coordinate frame messages may result in incorrectly rendered markers or
      // missing markers altogther.

      const targetTime = jumpSeek(DIRECTION.FORWARD, currentTime, ev, defaultStepSize);
      if (playUntil) {
        playUntil(targetTime);

        BroadcastManager.getInstance().postMessage({
          type: "playUntil",
          time: targetTime,
        });
      } else {
        seek(targetTime);

        BroadcastManager.getInstance().postMessage({
          type: "seek",
          time: targetTime,
        });
      }
    },
    [getTimeInfo, playUntil, seek, defaultStepSize],
  );

  const seekBackwardAction = useCallback(
    (ev?: KeyboardEvent) => {
      const { currentTime } = getTimeInfo();
      if (!currentTime) {
        return;
      }
      const targetTime = jumpSeek(DIRECTION.BACKWARD, currentTime, ev, defaultStepSize);
      seek(targetTime);

      BroadcastManager.getInstance().postMessage({
        type: "seek",
        time: targetTime,
      });
    },
    [defaultStepSize, getTimeInfo, seek],
  );

  return { seekForwardAction, seekBackwardAction };
}
