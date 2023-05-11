// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { Dialog, DialogTitle, IconButton, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { NotificationMessage } from "@foxglove/studio-base/util/sendNotification";

const useStyles = makeStyles()((theme) => ({
  container: {
    alignItems: "stretch",
    display: "flex",
    flexDirection: "column",
    maxHeight: "50vw",
    marginBlockEnd: theme.spacing(3),
    marginInline: theme.spacing(3),
  },
  paper: {
    maxWidth: 700,
    width: "70%",
  },
  text: {
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    fontSize: theme.typography.body1.fontSize,
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    whiteSpace: "pre-wrap",
  },
  iconButton: {
    position: "absolute",
    right: theme.spacing(1),
    top: theme.spacing(1),
  },
}));

export default function NotificationModal({
  notification: { details, message, severity, subText },
  onRequestClose,
}: {
  notification: NotificationMessage;
  onRequestClose?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const { classes } = useStyles();

  const displayPropsBySeverity = {
    error: theme.palette.error.main,
    warn: theme.palette.warning.main,
    info: theme.palette.info.main,
  };

  const detailsElement = useMemo(() => {
    if (details instanceof Error) {
      return <div className={classes.text}>{details.stack}</div>;
    } else if (details != undefined && details !== "") {
      return (
        <Typography style={{ whiteSpace: "pre-line" /* allow newlines in the details message */ }}>
          {details}
        </Typography>
      );
    } else if (subText) {
      return undefined;
    }

    return "No details provided";
  }, [classes, details, subText]);

  return (
    <Dialog classes={{ paper: classes.paper }} fullWidth open onClose={() => onRequestClose?.()}>
      <DialogTitle color={displayPropsBySeverity[severity]}>{message}</DialogTitle>
      <div className={classes.container}>
        {subText && <Typography mb={3}>{subText}</Typography>}
        {detailsElement}
      </div>
      <IconButton
        aria-label="close"
        onClick={() => onRequestClose?.()}
        className={classes.iconButton}
      >
        <CloseIcon />
      </IconButton>
    </Dialog>
  );
}
