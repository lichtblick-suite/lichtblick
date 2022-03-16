// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ITextStyles, Text, useTheme } from "@fluentui/react";
import { Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import { useMemo } from "react";

import Duration from "@foxglove/studio-base/components/Duration";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Timestamp from "@foxglove/studio-base/components/Timestamp";
import { subtractTimes } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/time";

import { MultilineMiddleTruncate } from "./MultilineMiddleTruncate";

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;
const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
  },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
  },
  source: {
    flexGrow: 1,
    minWidth: 0,
  },
}));

function DataSourceInfo(): JSX.Element {
  const classes = useStyles();
  const theme = useTheme();

  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const playerName = useMessagePipeline(selectPlayerName);

  const duration = startTime && endTime ? subtractTimes(endTime, startTime) : undefined;

  const subheaderStyles = useMemo(
    () =>
      ({
        root: {
          fontVariant: "small-caps",
          textTransform: "lowercase",
          color: theme.palette.neutralSecondaryAlt,
          letterSpacing: "0.5px",
          position: "sticky",
          top: 0,
        },
      } as ITextStyles),
    [theme],
  );

  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <div className={cx(classes.item, classes.source)}>
          <Text styles={subheaderStyles}>Current source</Text>
          <Text styles={{ root: { color: theme.palette.neutralSecondary } }}>
            {playerName ? <MultilineMiddleTruncate text={playerName} /> : <>&mdash;</>}
          </Text>
        </div>
      </header>

      <div className={classes.item}>
        <Text styles={subheaderStyles}>Start time</Text>
        {startTime ? (
          <Timestamp horizontal time={startTime} />
        ) : (
          <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary } }}>
            &mdash;
          </Text>
        )}
      </div>

      <div className={classes.item}>
        <Text styles={subheaderStyles}>End time</Text>
        {endTime ? (
          <Timestamp horizontal time={endTime} />
        ) : (
          <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary } }}>
            &mdash;
          </Text>
        )}
      </div>

      <div className={classes.item}>
        <Text styles={subheaderStyles}>Duration</Text>
        {duration ? (
          <Duration duration={duration} />
        ) : (
          <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary } }}>
            &mdash;
          </Text>
        )}
      </div>
    </div>
  );
}

export { DataSourceInfo };
