// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
  Dismiss16Filled,
  Info20Regular,
  Warning20Regular,
} from "@fluentui/react-icons";
import { Grow, IconButton, useTheme } from "@mui/material";
import { SnackbarProvider, SnackbarKey, useSnackbar } from "notistack";
import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

import { APP_BAR_HEIGHT } from "@foxglove/studio-base/components/AppBar/constants";

const anchorWithOffset = (origin: "top" | "bottom") => ({
  "&.SnackbarContainer-root": {
    top: origin === "top" ? APP_BAR_HEIGHT : undefined,
  },
});

const useStyles = makeStyles()((theme) => ({
  /* eslint-disable tss-unused-classes/unused-classes */
  root: {
    "&.SnackbarContainer-root": {
      maxHeight: `calc(100% - ${APP_BAR_HEIGHT}px)`,
    },
    ".SnackbarContent-root": {
      padding: theme.spacing(0.5, 1.5, 0.5, 1),

      ".MuiIconButton-root svg": {
        height: "1em",
        width: "1em",
        fontSize: "1rem",
      },
    },
    ".SnackbarItem-message": {
      padding: 0,
      gap: theme.spacing(1),
    },
  },
  container: {
    zIndex: theme.zIndex.tooltip,
  },
  containerAnchorOriginTopCenter: anchorWithOffset("top"),
  containerAnchorOriginTopRight: anchorWithOffset("top"),
  containerAnchorOriginTopLeft: anchorWithOffset("top"),
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
      <Dismiss16Filled />
    </IconButton>
  );
};

export default function StudioToastProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const { classes } = useStyles();
  const theme = useTheme();
  return (
    <SnackbarProvider
      action={(id) => <CloseSnackbarAction id={id} />}
      iconVariant={{
        default: <Info20Regular primaryFill={theme.palette.primary.main} />,
        info: <Info20Regular />,
        error: <DismissCircle20Regular />,
        warning: <Warning20Regular />,
        success: <CheckmarkCircle20Regular />,
      }}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      maxSnack={5}
      preventDuplicate
      TransitionComponent={Grow}
      classes={classes}
    >
      {props.children}
    </SnackbarProvider>
  );
}
