// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Container, Typography } from "@mui/material";
import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  root: {
    backgroundColor: theme.palette.background.default,
    display: "flex",
    flexDirection: "column",
    flex: "auto",
    alignItems: "center",
    justifyContent: "center",

    code: {
      color: theme.palette.primary.main,
      background: "transparent",
      padding: 0,
    },
  },
}));

export default function EmptyState({ children }: PropsWithChildren<unknown>): JSX.Element {
  const { classes } = useStyles();

  return (
    <div className={classes.root}>
      <Container maxWidth={false}>
        <Typography
          component="div"
          variant="body2"
          color="text.secondary"
          lineHeight={1.4}
          align="center"
        >
          {children}
        </Typography>
      </Container>
    </div>
  );
}
