// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CSSProperties, ReactNode } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(0, 0.5),
    textDecoration: "inherit",
    whiteSpace: "pre-line",
  },
}));

type Props = {
  children?: ReactNode;
  style?: CSSProperties;
};

export function DiffSpan(props: Props): React.JSX.Element {
  const { children, style } = props;

  const { classes } = useStyles();

  return (
    <span className={classes.root} style={style}>
      {children}
    </span>
  );
}
