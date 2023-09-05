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
import { Grow, IconButton } from "@mui/material";
import {
  SnackbarProvider,
  SnackbarKey,
  useSnackbar,
  MaterialDesignContent,
  CustomContentProps,
} from "notistack";
import { PropsWithChildren, forwardRef } from "react";
import { makeStyles } from "tss-react/mui";

import { APP_BAR_HEIGHT } from "@foxglove/studio-base/components/AppBar/constants";

const anchorWithOffset = (origin: "top" | "bottom") => ({
  "&.notistack-SnackbarContainer": {
    top: origin === "top" ? APP_BAR_HEIGHT : undefined,
  },
});

const useStyles = makeStyles<void, "icon" | "dismissButton">()((theme, _params, classes) => ({
  icon: {},
  dismissButton: {
    color: theme.palette.common.white,

    "svg:not(.MuiSvgIcon-root)": {
      fontSize: 16,
    },
  },
  root: {
    "#notistack-snackbar": {
      padding: 0,
      gap: theme.spacing(0.75),
    },
    "&.notistack-MuiContent": {
      padding: theme.spacing(0.5, 1.5, 0.5, 1),
      fontSize: theme.typography.body2.fontSize,
    },
    "&.notistack-MuiContent-default": {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,

      [`.${classes.icon}`]: { color: theme.palette.primary.main },
      [`.${classes.dismissButton}`]: { color: theme.palette.text.primary },
    },
    "&.notistack-MuiContent-success": {
      backgroundColor: theme.palette.success.main,
    },
    "&.notistack-MuiContent-error": {
      backgroundColor: theme.palette.error.main,
    },
    "&.notistack-MuiContent-info": {
      backgroundColor: theme.palette.info.main,
    },
    "&.notistack-MuiContent-warning": {
      backgroundColor: theme.palette.warning.main,
    },
  },
}));

const useContainerStyles = makeStyles()({
  /* eslint-disable tss-unused-classes/unused-classes */
  containerAnchorOriginBottomCenter: anchorWithOffset("bottom"),
  containerAnchorOriginBottomRight: anchorWithOffset("bottom"),
  containerAnchorOriginBottomLeft: anchorWithOffset("bottom"),
  containerAnchorOriginTopCenter: anchorWithOffset("top"),
  containerAnchorOriginTopRight: anchorWithOffset("top"),
  containerAnchorOriginTopLeft: anchorWithOffset("top"),
  /* eslint-enable tss-unused-classes/unused-classes */
});

const CloseSnackbarAction = ({ id }: { id: SnackbarKey }) => {
  const { closeSnackbar } = useSnackbar();
  const { classes } = useStyles();
  return (
    <IconButton
      size="small"
      className={classes.dismissButton}
      onClick={() => {
        closeSnackbar(id);
      }}
    >
      <Dismiss16Filled />
    </IconButton>
  );
};

const Snackbar = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const { classes } = useStyles();
  return <MaterialDesignContent ref={ref} {...props} className={classes.root} />;
});
Snackbar.displayName = "Snackbar";

export default function StudioToastProvider({ children }: PropsWithChildren<unknown>): JSX.Element {
  const { classes: containerClasses } = useContainerStyles();
  const { classes } = useStyles();
  return (
    <SnackbarProvider
      Components={{
        default: Snackbar,
        error: Snackbar,
        success: Snackbar,
        warning: Snackbar,
        info: Snackbar,
      }}
      action={(id) => <CloseSnackbarAction id={id} />}
      iconVariant={{
        default: <Info20Regular className={classes.icon} />,
        info: <Info20Regular className={classes.icon} />,
        error: <DismissCircle20Regular className={classes.icon} />,
        warning: <Warning20Regular className={classes.icon} />,
        success: <CheckmarkCircle20Regular className={classes.icon} />,
      }}
      anchorOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
      maxSnack={5}
      preventDuplicate
      TransitionComponent={Grow}
      classes={containerClasses}
    >
      {children}
    </SnackbarProvider>
  );
}
