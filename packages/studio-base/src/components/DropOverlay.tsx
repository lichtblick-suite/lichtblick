// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { alpha, Dialog, Typography } from "@mui/material";
import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  outer: {
    background: alpha(theme.palette.background.paper, 0.84),
    backgroundImage: `linear-gradient(${theme.palette.action.hover}, ${theme.palette.action.hover})`,
    pointerEvents: "none",
    padding: theme.spacing(5),
    boxShadow: "none",
    maxHeight: "none", // override inset for titlebar area on Windows desktop app
  },
  inner: {
    borderRadius: 16,
    height: "100%",
    border: `2px dashed ${theme.palette.text.primary}`,
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    padding: theme.spacing(5),
    lineHeight: "normal",
  },
}));

function DropOverlay(props: PropsWithChildren<{ open: boolean }>): JSX.Element {
  const { classes } = useStyles();
  return (
    <Dialog
      fullScreen
      open={props.open}
      style={{ zIndex: 10000000 }}
      classes={{ paperFullScreen: classes.outer }}
    >
      <div className={classes.inner}>
        <Typography variant="h1" align="center" component="div">
          {props.children}
        </Typography>
      </div>
    </Dialog>
  );
}

export default DropOverlay;
