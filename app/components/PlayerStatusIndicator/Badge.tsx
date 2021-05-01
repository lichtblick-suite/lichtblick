// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "@fluentui/react";
import { PropsWithChildren } from "react";

const radius = 4;

const useStyles = makeStyles((theme) => ({
  badge: {
    position: "absolute",
    top: -radius,
    right: -radius,
    width: radius * 2,
    height: radius * 2,
    borderRadius: radius,
    backgroundColor: theme.semanticColors.errorBackground ?? "red",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(1, 1, 1, 0.8)",
  },
}));

export function Badge(props: PropsWithChildren<unknown>): JSX.Element {
  const classes = useStyles();

  return (
    <span style={{ position: "relative" }}>
      {props.children}
      <div className={classes.badge} />
    </span>
  );
}
