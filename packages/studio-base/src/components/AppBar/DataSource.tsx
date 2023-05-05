// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ErrorCircle20Filled } from "@fluentui/react-icons";
import { ButtonBase, CircularProgress, IconButton } from "@mui/material";
import { useTranslation } from "react-i18next";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import {
  APP_BAR_PRIMARY_COLOR,
  APP_BAR_FOREGROUND_COLOR,
} from "@foxglove/studio-base/components/AppBar/constants";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";
import WssErrorModal from "@foxglove/studio-base/components/WssErrorModal";
import { useWorkspaceActions } from "@foxglove/studio-base/context/WorkspaceContext";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

const ICON_SIZE = 18;

const useStyles = makeStyles<void, "adornmentError" | "openIcon">()((theme, _params, classes) => ({
  sourceName: {
    font: "inherit",
    fontSize: theme.typography.body2.fontSize,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.5),
    paddingInlineEnd: theme.spacing(0.75),
    whiteSpace: "nowrap",
    minWidth: 0,

    "&button:not(:hover)": {
      color: tc(APP_BAR_FOREGROUND_COLOR).setAlpha(0.8).toString(),

      [`.${classes.openIcon}`]: {
        visibility: "hidden",
      },
    },
  },
  adornment: {
    display: "flex",
    flex: "none",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    color: APP_BAR_PRIMARY_COLOR,
    width: ICON_SIZE,
    height: ICON_SIZE,
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
      fontSize: "1rem",
    },
  },
  errorIconButton: {
    position: "relative",
    zIndex: 1,
    fontSize: ICON_SIZE - 2,
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
  const { dataSourceDialogActions, selectLeftSidebarItem, setLeftSidebarOpen } =
    useWorkspaceActions();

  const reconnecting = playerPresence === PlayerPresence.RECONNECTING;
  const initializing = playerPresence === PlayerPresence.INITIALIZING;
  const error =
    playerPresence === PlayerPresence.ERROR ||
    playerProblems.some((problem) => problem.severity === "error");
  const loading = reconnecting || initializing;

  const playerDisplayName =
    initializing && playerName == undefined ? "Initializing..." : playerName;

  const openDataSourceDialog = () => dataSourceDialogActions.open("start");

  if (playerPresence === PlayerPresence.NOT_PRESENT) {
    return (
      <ButtonBase className={classes.sourceName} color="inherit" onClick={openDataSourceDialog}>
        {t("noDataSource")}
      </ButtonBase>
    );
  }

  return (
    <>
      <WssErrorModal playerProblems={playerProblems} />
      <Stack direction="row" alignItems="center">
        <div className={classes.sourceName}>
          <div className={classes.textTruncate}>
            <TextMiddleTruncate text={playerDisplayName ?? "<unknown>"} />
          </div>
        </div>
        <div className={cx(classes.adornment, { [classes.adornmentError]: error })}>
          {loading && (
            <CircularProgress
              size={ICON_SIZE}
              color="inherit"
              className={classes.spinner}
              variant="indeterminate"
            />
          )}
          {error && (
            <IconButton
              color="inherit"
              className={cx(classes.iconButton, classes.errorIconButton)}
              onClick={() => {
                setLeftSidebarOpen(true);
                selectLeftSidebarItem("problems");
              }}
            >
              <ErrorCircle20Filled />
            </IconButton>
          )}
        </div>
      </Stack>
    </>
  );
}
