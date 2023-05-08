// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { Button } from "@mui/material";
import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";

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

export default function View(props: PropsWithChildren<ViewProps>): JSX.Element {
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
          onClick={() => dialogActions.dataSource.open("start")}
          size="large"
        >
          Back
        </Button>

        <Stack direction="row" gap={2}>
          <Button
            size="large"
            color="inherit"
            variant="outlined"
            onClick={() => dialogActions.dataSource.close()}
          >
            Cancel
          </Button>
          <Button size="large" variant="contained" onClick={onOpen} disabled={onOpen == undefined}>
            Open
          </Button>
        </Stack>
      </Stack>
    </>
  );

  return <>{props.children}</>;
}
