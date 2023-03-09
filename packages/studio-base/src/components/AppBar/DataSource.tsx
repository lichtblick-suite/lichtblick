// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ErrorIcon from "@mui/icons-material/Error";
import { Button, ButtonBase, CircularProgress, Divider, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import { APP_BAR_PRIMARY_COLOR } from "@foxglove/studio-base/components/AppBar/constants";
import { DataSourceInfoView } from "@foxglove/studio-base/components/DataSourceInfoView";
import { ProblemsList } from "@foxglove/studio-base/components/DataSourceSidebar/ProblemsList";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "grid",
    gridTemplateAreas: `"adornment sourceInfo arrow"`,
    gap: theme.spacing(0.75),
    gridAutoColumns: "19px 1fr 19px",
    paddingRight: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    font: "inherit",
    overflow: "hidden",
    maxWidth: "100%",

    ":hover": { opacity: 0.8 },
  },
  sourceInfo: {
    gridArea: "sourceInfo",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.25),
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  adornment: {
    gridArea: "adornment",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    color: APP_BAR_PRIMARY_COLOR,
    width: 19,
    height: 19,
  },
  arrow: {
    gridArea: "arrow",
  },
  adornmentError: {
    color: theme.palette.error.main,
  },
  divider: {
    borderColor: "currentColor",
    opacity: 0.4,
  },
  spinner: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    margin: "auto",
  },
  tooltip: {
    padding: 0,
  },
  playerName: {
    minWidth: 0,
  },
}));

const selectPlayerName = ({ playerState }: MessagePipelineContext) => playerState.name;
const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;

export function DataSource({
  onSelectDataSourceAction,
}: {
  onSelectDataSourceAction: () => void;
}): JSX.Element {
  const { classes, cx } = useStyles();
  const playerName = useMessagePipeline(selectPlayerName);
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerProblems = useMessagePipeline(selectPlayerProblems) ?? [];

  const reconnecting = playerPresence === PlayerPresence.RECONNECTING;
  const initializing = playerPresence === PlayerPresence.INITIALIZING;
  const error = playerPresence === PlayerPresence.ERROR || playerProblems.length > 0;
  const loading = reconnecting || initializing;

  const playerDisplayName =
    initializing && playerName == undefined ? "Initializing..." : playerName;

  const [problemModal, setProblemModal] = useState<JSX.Element | undefined>(undefined);

  if (playerPresence === PlayerPresence.NOT_PRESENT) {
    return (
      <Button size="small" color="inherit" variant="outlined" onClick={onSelectDataSourceAction}>
        <Typography noWrap variant="inherit" component="span">
          Open data source…
        </Typography>
      </Button>
    );
  }

  return (
    <>
      {problemModal}
      <Tooltip
        arrow={false}
        disableHoverListener={initializing}
        disableFocusListener={initializing}
        classes={{ tooltip: classes.tooltip }}
        placement="bottom"
        title={
          <>
            <Stack padding={1}>
              <Stack gap={1} padding={1}>
                <DataSourceInfoView />
              </Stack>
            </Stack>
            {error && (
              <>
                <Divider className={classes.divider} />
                <Stack paddingY={0.5}>
                  <ProblemsList problems={playerProblems} setProblemModal={setProblemModal} />
                </Stack>
              </>
            )}
          </>
        }
      >
        <ButtonBase color="inherit" className={classes.root} onClick={onSelectDataSourceAction}>
          <div className={cx(classes.adornment, { [classes.adornmentError]: error })}>
            {loading && (
              <CircularProgress
                size={19}
                color="inherit"
                className={classes.spinner}
                variant="indeterminate"
              />
            )}
            {error && <ErrorIcon color="error" fontSize={loading ? "small" : "medium"} />}
          </div>
          <div className={classes.sourceInfo}>
            <Typography noWrap variant="inherit" component="span">
              <TextMiddleTruncate
                className={classes.playerName}
                text={playerDisplayName ?? "<unknown>"}
              />
            </Typography>
          </div>
          <ArrowDropDownIcon className={classes.arrow} />
        </ButtonBase>
      </Tooltip>
    </>
  );
}
