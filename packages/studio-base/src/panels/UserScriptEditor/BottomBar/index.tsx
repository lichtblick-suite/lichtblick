// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
//

import { Badge, Button, Divider, Paper, Tab, Tabs, badgeClasses, tabClasses } from "@mui/material";
import { ReactElement, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import {
  UserScriptStore,
  useUserScriptState,
} from "@foxglove/studio-base/context/UserScriptStateContext";
import DiagnosticsSection from "@foxglove/studio-base/panels/UserScriptEditor/BottomBar/DiagnosticsSection";
import LogsSection from "@foxglove/studio-base/panels/UserScriptEditor/BottomBar/LogsSection";
import { Diagnostic, UserScriptLog } from "@foxglove/studio-base/players/UserScriptPlayer/types";

type Props = {
  diagnostics: readonly Diagnostic[];
  isSaved: boolean;
  logs: readonly UserScriptLog[];
  scriptId?: string;
  onChangeTab: () => void;
  save: () => void;
};

type BottomBarModes = "logs" | "diagnostics";

const TAB_HEIGHT = 36;

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflowY: "hidden",
  },
  badge: {
    alignItems: "center",

    [`.${badgeClasses.badge}`]: {
      margin: theme.spacing(-0.25, 0, -0.25, 1),
      position: "relative",
      transform: "none",

      [`&.${badgeClasses.invisible}`]: {
        display: "none",
      },
    },
  },
  tabs: {
    minHeight: TAB_HEIGHT,
    position: "relative",
    bottom: -1,

    [`.${tabClasses.root}`]: {
      minHeight: "auto",
      minWidth: theme.spacing(8),
      padding: theme.spacing(1.5, 2),
      color: theme.palette.text.secondary,

      "&.Mui-selected": {
        color: theme.palette.text.primary,
      },
    },
  },
}));

const selectUserScriptActions = (store: UserScriptStore) => store.actions;

const BottomBar = ({
  diagnostics,
  isSaved,
  logs,
  scriptId,
  onChangeTab,
  save,
}: Props): ReactElement => {
  const { classes } = useStyles();
  const [bottomBarDisplay, setBottomBarDisplay] = useState<BottomBarModes>("diagnostics");

  const { clearUserScriptLogs } = useUserScriptState(selectUserScriptActions);

  const handleChange = (_event: React.SyntheticEvent, value: BottomBarModes) => {
    setBottomBarDisplay(value);
  };

  const handleClick = () => {
    onChangeTab();
  };

  return (
    <>
      <Paper elevation={0} className={classes.root}>
        <Divider />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          paddingRight={1}
        >
          <Tabs
            className={classes.tabs}
            textColor="inherit"
            value={bottomBarDisplay}
            onChange={handleChange}
          >
            <Tab
              label={
                <Badge
                  color="error"
                  badgeContent={diagnostics.length}
                  invisible={diagnostics.length === 0}
                  className={classes.badge}
                >
                  Problems
                </Badge>
              }
              value="diagnostics"
              data-testid="np-errors"
              onClick={() => {
                handleClick();
              }}
            />
            <Tab
              label={
                <Badge
                  color="error"
                  className={classes.badge}
                  badgeContent={logs.length}
                  invisible={logs.length === 0}
                >
                  Logs
                </Badge>
              }
              value="logs"
              data-testid="np-logs"
              onClick={() => {
                handleClick();
              }}
            />
          </Tabs>
          <Stack direction="row" alignItems="center" gap={0.5} fullHeight>
            {bottomBarDisplay === "logs" && (
              <Button
                size="small"
                color="primary"
                variant="contained"
                data-testid="np-logs-clear"
                disabled={logs.length === 0}
                onClick={() => {
                  if (scriptId != undefined) {
                    clearUserScriptLogs(scriptId);
                  }
                }}
              >
                Clear logs
              </Button>
            )}
            <Button
              size="small"
              color="primary"
              variant="contained"
              disabled={isSaved}
              title="Ctrl/Cmd + S"
              onClick={() => {
                if (scriptId != undefined) {
                  save();
                  clearUserScriptLogs(scriptId);
                }
              }}
            >
              {isSaved ? "Saved" : "Save"}
            </Button>
          </Stack>
        </Stack>
        <Divider />
        {bottomBarDisplay === "diagnostics" && <DiagnosticsSection diagnostics={diagnostics} />}
        {bottomBarDisplay === "logs" && <LogsSection logs={logs} />}
      </Paper>
    </>
  );
};

export default BottomBar;
