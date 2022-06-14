// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link, List, ListItem, ListItemButton, ListItemText, Typography } from "@mui/material";
import Tree from "react-json-tree";

import Stack from "@foxglove/studio-base/components/Stack";
import { UserNodeLog } from "@foxglove/studio-base/players/UserNodePlayer/types";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

const LogsSection = ({ logs }: { logs: readonly UserNodeLog[] }): JSX.Element => {
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
    <List dense disablePadding>
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
