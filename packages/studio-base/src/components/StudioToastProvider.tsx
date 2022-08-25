// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ErrorIcon from "@mui/icons-material/CancelOutlined";
import SuccessIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import WarningIcon from "@mui/icons-material/WarningAmberOutlined";
import { Grow, IconButton } from "@mui/material";
import { SnackbarProvider, SnackbarKey, useSnackbar } from "notistack";
import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  /* eslint-disable tss-unused-classes/unused-classes */
  root: {
    ".SnackbarContent-root": { padding: theme.spacing(0.5, 1.5) },
  },
  variantDefault: {
    "&.SnackbarContent-root": {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
  },
  variantSuccess: {
    "&.SnackbarContent-root": { backgroundColor: theme.palette.success.main },
  },
  variantError: {
    "&.SnackbarContent-root": { backgroundColor: theme.palette.error.main },
  },
  variantInfo: {
    "&.SnackbarContent-root": { backgroundColor: theme.palette.info.main },
  },
  variantWarning: {
    "&.SnackbarContent-root": { backgroundColor: theme.palette.warning.main },
  },
  /* eslint-enable tss-unused-classes/unused-classes */
}));

const CloseSnackbarAction = ({ id }: { id: SnackbarKey }) => {
  const { closeSnackbar } = useSnackbar();
  return (
    <IconButton size="small" color="inherit" onClick={() => closeSnackbar(id)}>
      <CloseIcon fontSize="inherit" />
    </IconButton>
  );
};

export default function StudioToastProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const { classes } = useStyles();
  return (
    <SnackbarProvider
      action={(id) => <CloseSnackbarAction id={id} />}
      iconVariant={{
        default: <InfoIcon color="primary" style={{ marginInlineEnd: 8 }} />,
        info: <InfoIcon style={{ marginInlineEnd: 8, opacity: 0.6 }} />,
        error: <ErrorIcon style={{ marginInlineEnd: 8, opacity: 0.6 }} />,
        warning: <WarningIcon style={{ marginInlineEnd: 8, opacity: 0.6 }} />,
        success: <SuccessIcon style={{ marginInlineEnd: 8, opacity: 0.6 }} />,
      }}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      maxSnack={5}
      TransitionComponent={Grow}
      classes={classes}
    >
      {props.children}
    </SnackbarProvider>
  );
}
