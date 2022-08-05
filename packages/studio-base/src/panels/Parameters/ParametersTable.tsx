// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    whiteSpace: "nowrap",
    color: theme.palette.text.primary,
    flex: "auto",
    table: {
      width: "calc(100% + 1px)",
    },

    thead: {
      userSelect: "none",
      borderBottom: `1px solid ${theme.palette.divider}`,
    },

    "& table th, & table td": {
      padding: "6px 16px",
      lineHeight: "100%",
      border: "none",
    },

    "tr:first-child th": {
      padding: "6px 16px",
      border: "none",
      textAlign: "left",
      color: theme.palette.text.secondary,
      minWidth: "120px",
    },

    td: {
      input: {
        background: "none !important",
        color: "inherit",
        width: "100%",
        paddingLeft: 0,
        paddingRight: 0,
        minWidth: "40px",
      },
      "&:last-child": {
        color: theme.palette.text.secondary,
      },
    },
  },
}));

export default function ParametersTable(props: PropsWithChildren<unknown>): JSX.Element {
  const { classes } = useStyles();
  return <div className={classes.root}>{props.children}</div>;
}
