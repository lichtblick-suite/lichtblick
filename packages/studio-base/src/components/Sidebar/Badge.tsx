// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "@fluentui/react";
import { PropsWithChildren } from "react";

const radius = 8;

const useStyles = makeStyles((theme) => ({
  badge: {
    position: "absolute",
    bottom: -radius,
    right: -radius,
    width: radius * 2,
    height: radius * 2,
    borderRadius: radius,
    backgroundColor: theme.semanticColors.errorBackground ?? "red",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(1, 1, 1, 0.8)",
    fontSize: "8px",
    lineHeight: "14px",
  },
}));

export function Badge(props: PropsWithChildren<{ count?: number }>): JSX.Element {
  const classes = useStyles();
  const { count } = props;

  return (
    <span style={{ position: "relative" }}>
      {props.children}
      <div className={classes.badge}>{count == undefined ? "" : count}</div>
    </span>
  );
}
