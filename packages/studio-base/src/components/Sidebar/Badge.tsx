// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "@fluentui/react";
import { PropsWithChildren } from "react";

const radius = 7;

const useStyles = makeStyles((theme) => ({
  badge: {
    position: "absolute",
    bottom: -radius,
    right: -radius,
    width: radius * 2,
    height: radius * 2,
    borderRadius: radius,
    backgroundColor: theme.semanticColors.errorBackground ?? "red",
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 8,
    fontWeight: 700,
    fontFeatureSettings: "normal",
    letterSpacing: "-0.025em",
    lineHeight: radius * 2,
    textAlign: "center",
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
