// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { AppBar, IconButton, TextField } from "@mui/material";
import memoizeWeak from "memoize-weak";
import { useMemo, useState } from "react";
import { DeepReadonly } from "ts-essentials";
import { makeStyles } from "tss-react/mui";

import { SettingsTree } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";

import { NodeEditor } from "./NodeEditor";
import { filterTreeNodes, prepareSettingsNodes } from "./utils";

const useStyles = makeStyles()((theme) => ({
  appBar: {
    top: -1,
    zIndex: theme.zIndex.appBar - 1,
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(20%, 20ch) auto",
    columnGap: theme.spacing(1),
  },
}));

const makeStablePath = memoizeWeak((key: string) => [key]);

export default function SettingsTreeEditor({
  settings,
}: {
  settings: DeepReadonly<SettingsTree>;
}): JSX.Element {
  const { classes } = useStyles();
  const { actionHandler } = settings;
  const [filterText, setFilterText] = useState<string>("");

  const filteredNodes = useMemo(() => {
    if (filterText.length > 0) {
      return filterTreeNodes(settings.nodes, filterText);
    } else {
      return settings.nodes;
    }
  }, [settings.nodes, filterText]);

  const definedNodes = useMemo(() => prepareSettingsNodes(filteredNodes), [filteredNodes]);

  return (
    <Stack fullHeight>
      {settings.enableFilter === true && (
        <AppBar className={classes.appBar} position="sticky" color="default" elevation={0}>
          <TextField
            data-testid="settings-filter-field"
            onChange={(event) => setFilterText(event.target.value)}
            value={filterText}
            variant="filled"
            fullWidth
            placeholder="Filter"
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" />,
              endAdornment: filterText && (
                <IconButton
                  size="small"
                  title="Clear search"
                  onClick={() => setFilterText("")}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              ),
            }}
          />
        </AppBar>
      )}
      <div className={classes.fieldGrid}>
        {definedNodes.map(([key, root]) => (
          <NodeEditor
            key={key}
            actionHandler={actionHandler}
            defaultOpen={root.defaultExpansionState === "collapsed" ? false : true}
            filter={filterText}
            path={makeStablePath(key)}
            settings={root}
          />
        ))}
      </div>
    </Stack>
  );
}
