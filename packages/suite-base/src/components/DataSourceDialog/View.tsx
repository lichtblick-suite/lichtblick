// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { Button } from "@mui/material";
import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@lichtblick/suite-base/components/Stack";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";

type ViewProps = {
  onOpen?: () => void;
};

const useStyles = makeStyles()((theme) => ({
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    height: "100%",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    overflowY: "auto",
  },
}));

export default function View(props: PropsWithChildren<ViewProps>): React.JSX.Element {
  const { onOpen } = props;
  const { classes } = useStyles();
  const { dialogActions } = useWorkspaceActions();

  return (
    <>
      <div className={classes.content}>{props.children}</div>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        paddingX={4}
        paddingBottom={4}
        paddingTop={2}
      >
        <Button
          startIcon={<ChevronLeftIcon fontSize="large" />}
          onClick={() => {
            dialogActions.dataSource.open("start");
          }}
        >
          Back
        </Button>

        <Stack direction="row" gap={2}>
          <Button
            color="inherit"
            variant="outlined"
            onClick={() => {
              dialogActions.dataSource.close();
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={onOpen} disabled={onOpen == undefined}>
            Open
          </Button>
        </Stack>
      </Stack>
    </>
  );

  return <>{props.children}</>;
}
