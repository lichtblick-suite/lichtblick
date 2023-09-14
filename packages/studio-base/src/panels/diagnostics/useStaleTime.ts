// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useMemo, useState } from "react";

import { Time, clampTime, subtract } from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";

const DEFAULT_UPDATE_INTERVAL_MS = 1_000;

const selectLastSeekTime = (ctx: MessagePipelineContext) =>
  ctx.playerState.activeData?.lastSeekTime;

// Returns a time which specifies from when diagnostic messages are considered stale.
export default function useStaleTime(
  secondsUntilStale: number,
  updateIntervalMillis?: number,
): Time | undefined {
  const messagePipeline = useMessagePipelineGetter();
  const getCurrentTime = useCallback(() => {
    const { playerState } = messagePipeline();
    return playerState.activeData?.currentTime;
  }, [messagePipeline]);

  const [currentTime, setCurrentTime] = useState<Time | undefined>(() => getCurrentTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, updateIntervalMillis ?? DEFAULT_UPDATE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [getCurrentTime, updateIntervalMillis]);

  const lastSeekTime = useMessagePipeline(selectLastSeekTime);
  useEffect(() => {
    setCurrentTime(getCurrentTime());
  }, [getCurrentTime, lastSeekTime]);

  return useMemo(() => {
    const timeUntilStale: Time = { sec: Math.floor(secondsUntilStale), nsec: 0 };
    return currentTime && secondsUntilStale >= 1
      ? subtract(clampTime(currentTime, timeUntilStale, currentTime), timeUntilStale)
      : undefined;
  }, [currentTime, secondsUntilStale]);
}
