// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Skeleton, Typography } from "@mui/material";
import { MutableRefObject, useEffect, useRef } from "react";
import { makeStyles } from "tss-react/mui";

import { Time } from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import Timestamp from "@foxglove/studio-base/components/Timestamp";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { subtractTimes } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/time";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { formatDate, formatDuration } from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { MultilineMiddleTruncate } from "./MultilineMiddleTruncate";

const useStyles = makeStyles()({
  numericValue: {
    fontFamily: fonts.MONOSPACE,
  },
});

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;
const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;
const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;

function DataSourceInfoContent(props: {
  durationRef: MutableRefObject<ReactNull | HTMLDivElement>;
  endTimeRef: MutableRefObject<ReactNull | HTMLDivElement>;
  playerName?: string;
  playerPresence: PlayerPresence;
  startTime?: Time;
}): JSX.Element {
  const { durationRef, endTimeRef, playerName, playerPresence, startTime } = props;
  const { classes } = useStyles();

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
          <Typography className={classes.numericValue} variant="inherit">
            &mdash;
          </Typography>
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
          <Typography className={classes.numericValue} variant="inherit" color="text.secondary">
            &mdash;
          </Typography>
        )}
      </Stack>

      <Stack>
        <Typography variant="overline" color="text.secondary">
          End time
        </Typography>
        {playerPresence === PlayerPresence.INITIALIZING ? (
          <Skeleton animation="wave" width="50%" />
        ) : (
          <Typography className={classes.numericValue} variant="inherit" ref={endTimeRef}>
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
        ) : (
          <Typography className={classes.numericValue} variant="inherit" ref={durationRef}>
            &mdash;
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

const MemoDataSourceInfoContent = React.memo(DataSourceInfoContent);

const EmDash = "\u2014";

export function DataSourceInfoView(): JSX.Element {
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const playerName = useMessagePipeline(selectPlayerName);
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const durationRef = useRef<HTMLDivElement>(ReactNull);
  const endTimeRef = useRef<HTMLDivElement>(ReactNull);
  const { formatTime } = useAppTimeFormat();

  // We bypass react and update the DOM elements directly for better performance here.
  useEffect(() => {
    if (durationRef.current) {
      const duration = endTime && startTime ? subtractTimes(endTime, startTime) : undefined;
      if (duration) {
        const durationStr = formatDuration(duration);
        durationRef.current.innerText = durationStr;
      } else {
        durationRef.current.innerText = EmDash;
      }
    }
    if (endTimeRef.current) {
      if (endTime) {
        const date = formatDate(endTime, undefined);
        endTimeRef.current.innerText = `${date} ${formatTime(endTime)}`;
      } else {
        endTimeRef.current.innerHTML = EmDash;
      }
    }
  }, [endTime, formatTime, startTime, playerPresence]);

  return (
    <MemoDataSourceInfoContent
      durationRef={durationRef}
      endTimeRef={endTimeRef}
      playerName={playerName}
      playerPresence={playerPresence}
      startTime={startTime}
    />
  );
}
