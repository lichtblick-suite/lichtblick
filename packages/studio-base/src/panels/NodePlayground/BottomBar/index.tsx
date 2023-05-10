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

import {
  Badge,
  Button,
  Paper,
  Tab,
  Tabs,
  Divider,
  Collapse,
  tabClasses,
  badgeClasses,
} from "@mui/material";
import { useState, useRef, useEffect, ReactElement } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { useUserNodeState } from "@foxglove/studio-base/context/UserNodeStateContext";
import DiagnosticsSection from "@foxglove/studio-base/panels/NodePlayground/BottomBar/DiagnosticsSection";
import LogsSection from "@foxglove/studio-base/panels/NodePlayground/BottomBar/LogsSection";
import { Diagnostic, UserNodeLog } from "@foxglove/studio-base/players/UserNodePlayer/types";

type Props = {
  nodeId?: string;
  isSaved: boolean;
  save: () => void;
  diagnostics: readonly Diagnostic[];
  logs: readonly UserNodeLog[];
};

type BottomBarModes = "logs" | "diagnostics" | "closed";

const TAB_HEIGHT = 36;

const useStyles = makeStyles()((theme) => ({
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

const BottomBar = ({ nodeId, isSaved, save, diagnostics, logs }: Props): ReactElement => {
  const { classes } = useStyles();
  const [bottomBarDisplay, setBottomBarDisplay] = useState<BottomBarModes>("closed");
  const [autoScroll, setAutoScroll] = useState(true);

  const { clearUserNodeLogs } = useUserNodeState();
  const scrollContainer = useRef<HTMLDivElement>(ReactNull);

  const handleChange = (_event: React.SyntheticEvent, value: BottomBarModes) => {
    setBottomBarDisplay(value);
  };

  const handleClick = (value: BottomBarModes) => {
    if (bottomBarDisplay === value) {
      setBottomBarDisplay("closed");
    }
  };

  useEffect(() => {
    if (autoScroll) {
      if (scrollContainer.current) {
        scrollContainer.current.scrollTop = scrollContainer.current.scrollHeight;
      }
    }
  }, [autoScroll, logs]);

  return (
    <>
      <Paper elevation={0}>
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
            value={bottomBarDisplay !== "closed" ? bottomBarDisplay : false}
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
              onClick={() => handleClick("diagnostics")}
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
              onClick={() => handleClick("logs")}
            />
          </Tabs>
          <Stack direction="row" alignItems="center" gap={0.5}>
            {bottomBarDisplay === "logs" && (
              <Button
                size="small"
                color="primary"
                variant="contained"
                data-testid="np-logs-clear"
                disabled={logs.length === 0}
                onClick={() => {
                  if (nodeId != undefined) {
                    clearUserNodeLogs(nodeId);
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
                if (nodeId != undefined) {
                  save();
                  clearUserNodeLogs(nodeId);
                }
              }}
            >
              {isSaved ? "Saved" : "Save"}
            </Button>
          </Stack>
        </Stack>
        {bottomBarDisplay !== "closed" && <Divider />}
      </Paper>
      <Paper elevation={0}>
        <Stack fullHeight position="relative">
          <Collapse
            onScroll={({ currentTarget }) => {
              const scrolledUp =
                currentTarget.scrollHeight - currentTarget.scrollTop > currentTarget.clientHeight;
              if (scrolledUp && autoScroll) {
                setAutoScroll(false);
              } else if (!scrolledUp && !autoScroll) {
                setAutoScroll(true);
              }
            }}
            ref={scrollContainer}
            in={bottomBarDisplay !== "closed"}
          >
            <Stack overflow="auto" style={{ height: 150 }}>
              {bottomBarDisplay === "diagnostics" && (
                <DiagnosticsSection diagnostics={diagnostics} />
              )}
              {bottomBarDisplay === "logs" && <LogsSection logs={logs} />}
            </Stack>
          </Collapse>
        </Stack>
      </Paper>
    </>
  );
};

export default BottomBar;
