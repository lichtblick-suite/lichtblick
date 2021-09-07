// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";

import { Time } from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { compare } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/time";

type Props = {
  isPlaying: boolean;
  repeatEnabled: boolean;
  play: () => void;
  pause: () => void;
  seek: (to: Time) => void;
};

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;

export default function RepeatAdapter(props: Props): JSX.Element {
  const { play, pause, seek, repeatEnabled, isPlaying } = props;

  const startTime = useMessagePipeline(selectStartTime);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const endTime = useMessagePipeline(selectEndTime);

  // This effect runs on every render and checks if we need to seek back to start
  useEffect(() => {
    // repeat logic could also live in messagePipeline but since it is only triggered
    // from playback controls we've implemented it here for now - if there is demand
    // to toggle repeat from elsewhere this logic can move
    if (currentTime && endTime && compare(currentTime, endTime) >= 0) {
      // repeat
      if (startTime && repeatEnabled) {
        seek(startTime);
        // if the user turns on repeat and we are at the end, we assume they want to play from start
        // even if paused
        play();
      } else if (isPlaying) {
        // no-repeat
        // pause playback to toggle pause button state
        // if the user clicks play while we are at the end, we go back to begginning
        pause();
      }
    }
  });

  return <></>;
}
