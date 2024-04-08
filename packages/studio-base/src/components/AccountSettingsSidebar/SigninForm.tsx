// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";

import AccountSyncGraphic from "./AccountSyncGraphic";

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2.5),
  },
  icon: {
    display: "flex",
    justifyContent: "center",
    color: theme.palette.primary.main,
  },
}));

export default function SigninForm(): JSX.Element {
  const { classes } = useStyles();
  const { signIn } = useCurrentUser();

  return (
    <div className={classes.root}>
      <div className={classes.icon}>
        <AccountSyncGraphic width={192} />
      </div>
      <Typography variant="body1">
        <>
          Create a Foxglove account to:
          <ul>
            <li>Sync your layouts across multiple devices</li>
            <li>Share your layouts with others</li>
            <li>Manage and store your robotics data</li>
          </ul>
        </>
      </Typography>

      <Button variant="contained" color="primary" onClick={signIn}>
        Sign in
      </Button>
    </div>
  );
}
