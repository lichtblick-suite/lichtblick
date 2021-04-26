// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { makeStyles } from "@fluentui/react";
import { PropsWithChildren } from "react";

const useStyles = makeStyles({
  root: {
    position: "absolute",
    top: 30,
    right: 6,
    padding: 0,
    zIndex: 101,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
});

export default function Toolbar(props: PropsWithChildren<unknown>): JSX.Element {
  const classes = useStyles();
  return <div className={classes.root}>{props.children}</div>;
}
