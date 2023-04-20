// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ErrorCircle20Filled, Open16Filled } from "@fluentui/react-icons";
import { ButtonBase, CircularProgress, IconButton, Tooltip } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import {
  APP_BAR_PRIMARY_COLOR,
  APP_BAR_FOREGROUND_COLOR,
} from "@foxglove/studio-base/components/AppBar/constants";
import { ProblemsList } from "@foxglove/studio-base/components/DataSourceSidebar/ProblemsList";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";
import WssErrorModal from "@foxglove/studio-base/components/WssErrorModal";
import { useWorkspaceActions } from "@foxglove/studio-base/context/WorkspaceContext";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

const LEFT_ICON_SIZE = 19;

const useStyles = makeStyles<void, "adornmentError" | "openIcon">()((theme, _params, classes) => ({
  button: {
    font: "inherit",
    fontSize: theme.typography.body2.fontSize,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.5),
    whiteSpace: "nowrap",
    minWidth: 0,

    ":not(:hover)": {
      color: tc(APP_BAR_FOREGROUND_COLOR).setAlpha(0.8).toString(),

      [`.${classes.openIcon}`]: {
        visibility: "hidden",
      },
    },
    "&.Mui-disabled": {
      color: tc(APP_BAR_FOREGROUND_COLOR).setAlpha(theme.palette.action.disabledOpacity).toString(),
    },
  },
  adornment: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    color: APP_BAR_PRIMARY_COLOR,
    width: LEFT_ICON_SIZE,
    height: LEFT_ICON_SIZE,
  },
  adornmentError: {
    color: theme.palette.error.main,
  },
  spinner: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    margin: "auto",
  },
  textTruncate: {
    maxWidth: "30vw",
    overflow: "hidden",
  },
  openIcon: {
    opacity: 0.6,
    flex: "none",
  },
  iconButton: {
    padding: 0,

    "svg:not(.MuiSvgIcon-root)": {
      fontSize: "1em",
    },
  },
  errorIconButton: {
    position: "relative",
    zIndex: 1,
    fontSize: LEFT_ICON_SIZE - 1,
  },
  tooltip: {
    padding: 0,
  },
}));

const selectPlayerName = ({ playerState }: MessagePipelineContext) => playerState.name;
const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;

export function DataSource(): JSX.Element {
  const { t } = useTranslation("appBar");
  const { classes, cx } = useStyles();

  const playerName = useMessagePipeline(selectPlayerName);
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerProblems = useMessagePipeline(selectPlayerProblems) ?? [];
  const { dataSourceDialogActions } = useWorkspaceActions();

  const reconnecting = playerPresence === PlayerPresence.RECONNECTING;
  const initializing = playerPresence === PlayerPresence.INITIALIZING;
  const error =
    playerPresence === PlayerPresence.ERROR ||
    playerProblems.some((problem) => problem.severity === "error");
  const loading = reconnecting || initializing;

  const playerDisplayName =
    initializing && playerName == undefined ? "Initializing..." : playerName;

  const [problemModal, setProblemModal] = useState<JSX.Element | undefined>(undefined);

  const openDataSourceDialog = () => dataSourceDialogActions.open("start");

  if (playerPresence === PlayerPresence.NOT_PRESENT) {
    return (
      <ButtonBase className={classes.button} color="inherit" onClick={openDataSourceDialog}>
        {t("openDataSource")}
      </ButtonBase>
    );
  }

  return (
    <>
      {problemModal}
      <WssErrorModal playerProblems={playerProblems} />
      <Stack direction="row" alignItems="center">
        <ButtonBase className={classes.button} onClick={openDataSourceDialog}>
          <div className={cx(classes.adornment, { [classes.adornmentError]: error })}>
            {loading && (
              <CircularProgress
                size={LEFT_ICON_SIZE}
                color="inherit"
                className={classes.spinner}
                variant="indeterminate"
              />
            )}
            {error && (
              <Tooltip
                arrow={false}
                disableHoverListener={initializing}
                disableFocusListener={initializing}
                classes={{ tooltip: classes.tooltip }}
                placement="bottom"
                title={<ProblemsList problems={playerProblems} setProblemModal={setProblemModal} />}
              >
                <IconButton
                  color="inherit"
                  className={cx(classes.iconButton, classes.errorIconButton)}
                >
                  <ErrorCircle20Filled />
                </IconButton>
              </Tooltip>
            )}
          </div>
          <div className={classes.textTruncate}>
            <TextMiddleTruncate text={playerDisplayName ?? "<unknown>"} />
          </div>
          <Open16Filled className={classes.openIcon} />
        </ButtonBase>
      </Stack>
    </>
  );
}
