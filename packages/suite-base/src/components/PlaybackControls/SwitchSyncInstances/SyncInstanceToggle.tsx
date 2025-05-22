// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Stack, Button, Typography } from "@mui/material";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";

import { useStyles } from "./SyncInstanceToggle.style";

const SyncInstanceToggle = (): React.JSX.Element => {
  const [enableSyncLBInstances = false] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_SYNC_LB_INSTANCES,
  );

  const syncInstances = useWorkspaceStore((store) => store.playbackControls.syncInstances);

  const {
    playbackControlActions: { setSyncInstances },
  } = useWorkspaceActions();

  const { classes } = useStyles({ syncInstances });

  if (!enableSyncLBInstances) {
    // Turn off sync if experimental feature is turned off
    if (syncInstances) {
      setSyncInstances(false);
    }
    return <></>;
  }

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
