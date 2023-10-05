// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link, List, ListItem, ListItemButton, ListItemText, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import Tree from "react-json-tree";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { UserScriptLog } from "@foxglove/studio-base/players/UserScriptPlayer/types";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

const useStyles = makeStyles()({
  list: {
    height: "100%",
    overflowY: "auto",
  },
});

const LogsSection = ({ logs }: { logs: readonly UserScriptLog[] }): JSX.Element => {
  // Manage auto-scroll behavior when user is also manually scrolling the list.
  const [autoScroll, setAutoScroll] = useState(true);

  const { classes } = useStyles();

  const listRef = useRef<HTMLUListElement>(ReactNull);

  useEffect(() => {
    if (autoScroll) {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
  }, [autoScroll, logs]);

  useEffect(() => {
    const ref = listRef.current;
    function listener(event: WheelEvent) {
      if (event.deltaY < 0) {
        setAutoScroll(false);
      } else {
        const scrolledUp = ref != undefined && ref.scrollHeight - ref.scrollTop > ref.clientHeight;
        if (scrolledUp) {
          setAutoScroll(true);
        }
      }
    }

    ref?.addEventListener("wheel", listener);

    return () => {
      ref?.removeEventListener("wheel", listener);
    };
  }, []);

  const jsonTreeTheme = useJsonTreeTheme();
  const valueColorMap: Record<string, string> = {
    string: jsonTreeTheme.base0B,
    number: jsonTreeTheme.base09,
    boolean: jsonTreeTheme.base09,
    object: jsonTreeTheme.base08, // null
    undefined: jsonTreeTheme.base08,
  };
  if (logs.length === 0) {
    return (
      <Stack gap={0.5} padding={2}>
        <Typography variant="body2" color="text.secondary">
          No logs to display.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Invoke <code>log(someValue)</code> in your Foxglove Studio node code to see data printed
          here.
        </Typography>
      </Stack>
    );
  }
  return (
    <List dense disablePadding ref={listRef} className={classes.list}>
      {logs.map(({ source, value }, idx) => {
        const renderTreeObj = value != undefined && typeof value === "object";
        return (
          <ListItem
            disablePadding
            key={`${idx}${source}`}
            secondaryAction={
              <Link underline="always" variant="body2" color="text.secondary">
                {source}
              </Link>
            }
          >
            <ListItemButton>
              {renderTreeObj ? (
                <Tree hideRoot data={value} invertTheme={false} theme={jsonTreeTheme} />
              ) : (
                <ListItemText
                  primary={
                    value == undefined || value === false
                      ? String(value)
                      : (value as React.ReactNode)
                  }
                  primaryTypographyProps={{
                    color: valueColorMap[typeof value] ?? "text.primary",
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};

export default LogsSection;
