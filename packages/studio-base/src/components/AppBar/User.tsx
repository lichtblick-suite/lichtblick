// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import PersonIcon from "@mui/icons-material/Person";
import {
  Avatar,
  Divider,
  IconButton,
  IconButtonProps,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { forwardRef, useCallback } from "react";
import { makeStyles } from "tss-react/mui";

import Logger from "@foxglove/log";
import { APP_BAR_PRIMARY_COLOR } from "@foxglove/studio-base/components/AppBar/constants";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";

const log = Logger.getLogger(__filename);

const useStyles = makeStyles()((theme) => ({
  avatar: {
    color: theme.palette.common.white,
    backgroundColor: APP_BAR_PRIMARY_COLOR,
    height: theme.spacing(3.25),
    width: theme.spacing(3.25),
    marginLeft: theme.spacing(0.5),
  },
  avatarButton: {
    padding: 0,
  },
}));

export const UserIconButton = forwardRef<HTMLButtonElement, IconButtonProps>((props, ref) => {
  const { classes } = useStyles();

  return (
    <IconButton {...props} ref={ref} className={classes.avatarButton}>
      <Avatar className={classes.avatar} variant="rounded">
        <PersonIcon />
      </Avatar>
    </IconButton>
  );
});
UserIconButton.displayName = "UserIconButton";

export function UserMenu({
  anchorEl,
  handleClose,
  open,
}: {
  handleClose: () => void;
  anchorEl?: HTMLElement;
  open: boolean;
}): JSX.Element {
  const { currentUser, signOut } = useCurrentUser();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmModal] = useConfirm();

  const beginSignOut = useCallback(async () => {
    try {
      await signOut?.();
    } catch (error) {
      log.error(error);
      enqueueSnackbar((error as Error).toString(), { variant: "error" });
    }
  }, [enqueueSnackbar, signOut]);

  const onSignoutClick = useCallback(() => {
    void confirm({
      title: "Are you sure you want to sign out?",
      ok: "Sign out",
    }).then((response) => {
      if (response === "ok") {
        void beginSignOut();
      }
    });
  }, [beginSignOut, confirm]);

  const onSettingsClick = useCallback(() => {
    window.open(process.env.FOXGLOVE_ACCOUNT_DASHBOARD_URL, "_blank");
  }, []);

  if (currentUser == undefined) {
    return <></>;
  }
  return (
    <>
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        MenuListProps={{
          sx: {
            minWidth: 200,
          },
        }}
      >
        <MenuItem onClick={onSettingsClick}>
          <ListItemText primary={currentUser.email} />
        </MenuItem>
        <MenuItem onClick={onSettingsClick}>
          <ListItemText>User settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={onSignoutClick}>
          <ListItemText>Log out</ListItemText>
        </MenuItem>
      </Menu>
      {confirmModal}
    </>
  );
}
