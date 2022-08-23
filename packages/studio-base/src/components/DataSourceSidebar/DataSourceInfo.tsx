// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Skeleton, Typography } from "@mui/material";
import { useDebounce } from "use-debounce";

import { Time } from "@foxglove/rostime";
import Duration from "@foxglove/studio-base/components/Duration";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import Timestamp from "@foxglove/studio-base/components/Timestamp";
import { subtractTimes } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/time";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

import { MultilineMiddleTruncate } from "../MultilineMiddleTruncate";

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;
const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;
const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;

function DataSourceInfoContent(props: {
  duration?: Time;
  endTime?: Time;
  playerName?: string;
  playerPresence: PlayerPresence;
  startTime?: Time;
}): JSX.Element {
  const { duration, endTime, playerName, playerPresence, startTime } = props;

  return (
    <Stack gap={1.5} paddingX={2} paddingBottom={2}>
      <Stack>
        <Typography display="block" variant="overline" color="text.secondary">
          Current source
        </Typography>
        {playerPresence === PlayerPresence.INITIALIZING ? (
          <Typography variant="inherit">
            <Skeleton animation="wave" width="40%" />
          </Typography>
        ) : playerPresence === PlayerPresence.RECONNECTING ? (
          <Typography variant="inherit">Waiting for connection…</Typography>
        ) : playerName ? (
          <Typography variant="inherit" component="span">
            <MultilineMiddleTruncate text={playerName} />
          </Typography>
        ) : (
          <Typography>&mdash;</Typography>
        )}
      </Stack>

      <Stack>
        <Typography variant="overline" color="text.secondary">
          Start time
        </Typography>
        {playerPresence === PlayerPresence.INITIALIZING ? (
          <Skeleton animation="wave" width="50%" />
        ) : startTime ? (
          <Timestamp horizontal time={startTime} />
        ) : (
          <Typography color="text.secondary">&mdash;</Typography>
        )}
      </Stack>

      <Stack>
        <Typography variant="overline" color="text.secondary">
          End time
        </Typography>
        {playerPresence === PlayerPresence.INITIALIZING ? (
          <Skeleton animation="wave" width="50%" />
        ) : endTime ? (
          <Timestamp horizontal time={endTime} />
        ) : (
          <Typography variant="inherit" color="text.secondary">
            &mdash;
          </Typography>
        )}
      </Stack>

      <Stack>
        <Typography variant="overline" color="text.secondary">
          Duration
        </Typography>
        {playerPresence === PlayerPresence.INITIALIZING ? (
          <Skeleton animation="wave" width={100} />
        ) : duration ? (
          <Duration duration={duration} />
        ) : (
          <Typography variant="inherit" color="text.secondary">
            &mdash;
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

const MemoDataSourceInfoContent = React.memo(DataSourceInfoContent);

function DataSourceInfo(): JSX.Element {
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const playerName = useMessagePipeline(selectPlayerName);
  const playerPresence = useMessagePipeline(selectPlayerPresence);

  const [debouncedTimes] = useDebounce(
    { endTime, duration: startTime && endTime ? subtractTimes(endTime, startTime) : undefined },
    100,
    { leading: true, maxWait: 100 },
  );

  return (
    <MemoDataSourceInfoContent
      duration={debouncedTimes.duration}
      endTime={debouncedTimes.endTime}
      playerName={playerName}
      playerPresence={playerPresence}
      startTime={startTime}
    />
  );
}

export { DataSourceInfo };
