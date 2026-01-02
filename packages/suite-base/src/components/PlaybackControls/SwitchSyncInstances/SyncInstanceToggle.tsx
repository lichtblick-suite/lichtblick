// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Stack, Button, Typography } from "@mui/material";

import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";

import { useStyles } from "./SyncInstanceToggle.style";

const SyncInstanceToggle = (): React.JSX.Element => {
  const syncInstances = useWorkspaceStore((store) => store.playbackControls.syncInstances);

  const {
    playbackControlActions: { setSyncInstances },
  } = useWorkspaceActions();

  const { classes } = useStyles({ syncInstances });

  const handleToogle = () => {
    setSyncInstances(!syncInstances);
  };

  return (
    <Button className={classes.button} onClick={handleToogle}>
      <Stack className={classes.textWrapper}>
        <Typography className={classes.syncText}>Sync</Typography>
        <Typography className={classes.onOffText}>{syncInstances ? "on" : "off"}</Typography>
      </Stack>
    </Button>
  );
};

export default SyncInstanceToggle;
