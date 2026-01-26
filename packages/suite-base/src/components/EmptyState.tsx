// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@lichtblick/suite-base/components/Stack";

const useStyles = makeStyles()((theme) => ({
  root: {
    whiteSpace: "pre-line",

    code: {
      color: theme.palette.primary.main,
      background: "transparent",
      padding: 0,
    },
  },
}));

export default function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  const { classes, cx } = useStyles();

  return (
    <Stack
      className={cx(classes.root, className)}
      flex="auto"
      alignItems="center"
      justifyContent="center"
      fullHeight
      paddingX={1}
    >
      <Typography variant="body2" color="text.secondary" lineHeight={1.4} align="center">
        {children}
      </Typography>
    </Stack>
  );
}
