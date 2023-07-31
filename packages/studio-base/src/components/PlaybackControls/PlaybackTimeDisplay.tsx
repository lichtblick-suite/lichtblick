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

import { Time } from "@foxglove/rostime";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";

import PlaybackTimeDisplayMethod from "./PlaybackTimeDisplayMethod";

type Props = {
  onSeek: (seekTo: Time) => void;
  onPause: () => void;
};

const selectIsPlaying = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.isPlaying;
const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;
const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;

export default function PlaybackTimeDisplay(props: Props): JSX.Element {
  const [timezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);

  const isPlaying = useMessagePipeline(selectIsPlaying);
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const currentTime = useMessagePipeline(selectCurrentTime);

  return (
    <PlaybackTimeDisplayMethod
      currentTime={currentTime}
      startTime={startTime}
      endTime={endTime}
      onSeek={props.onSeek}
      onPause={props.onPause}
      isPlaying={isPlaying ?? false}
      timezone={timezone}
    />
  );
}
