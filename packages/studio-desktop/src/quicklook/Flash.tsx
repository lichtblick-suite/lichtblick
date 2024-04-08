// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(() => ({
  root: {
    padding: 12,
    borderRadius: 4,
    border: "1px dashed",
  },
  info: {
    color: "#8a8a8a",
    backgroundColor: "#f5f5f5",
    borderColor: "#dfdfdf",

    "@media (prefers-color-scheme: dark)": {
      color: "#bbbbbb",
      backgroundColor: "#4e4e4e",
      borderColor: "#727272",
    },
  },
  error: {
    backgroundColor: "#ffeaea",
    borderColor: "#cc5f5f",

    "@media (prefers-color-scheme: dark)": {
      backgroundColor: "#673636",
      borderColor: "#bb5959",
    },
  },
}));

export default function Flash(props: PropsWithChildren<{ color?: "error" | "info" }>): JSX.Element {
  const { children, color = "info" } = props;
  const { classes, cx } = useStyles();

  return (
    <div
      className={cx(classes.root, {
        [classes.info]: color === "info",
        [classes.error]: color === "error",
      })}
    >
      {children}
    </div>
  );
}
