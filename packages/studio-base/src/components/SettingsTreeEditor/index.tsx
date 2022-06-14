// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { AppBar, IconButton, TextField, styled as muiStyled } from "@mui/material";
import memoizeWeak from "memoize-weak";
import { useMemo, useState } from "react";
import { DeepReadonly } from "ts-essentials";

import Stack from "@foxglove/studio-base/components/Stack";

import { NodeEditor } from "./NodeEditor";
import { SettingsTree, SettingsTreeNode } from "./types";

const StyledAppBar = muiStyled(AppBar, { skipSx: true })(({ theme }) => ({
  top: -1,
  zIndex: theme.zIndex.appBar - 1,
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1),
}));

const FieldGrid = muiStyled("div", { skipSx: true })(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(4rem, 1fr) minmax(4rem, 12rem)",
  columnGap: theme.spacing(1),
}));

const makeStablePath = memoizeWeak((key: string) => [key]);

export default function SettingsTreeEditor({
  settings,
}: {
  settings: DeepReadonly<SettingsTree>;
}): JSX.Element {
  const { actionHandler } = settings;
  const [filterText, setFilterText] = useState<string>("");

  const definedRoots = useMemo(
    () =>
      Object.entries(settings.roots).filter(
        (kv): kv is [string, SettingsTreeNode] => kv[1] != undefined,
      ),
    [settings.roots],
  );

  return (
    <Stack fullHeight>
      {settings.enableFilter === true && (
        <StyledAppBar position="sticky" color="default" elevation={0}>
          <TextField
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
        </StyledAppBar>
      )}
      <FieldGrid>
        {definedRoots.map(([key, root]) => (
          <NodeEditor
            key={key}
            path={makeStablePath(key)}
            settings={root}
            defaultOpen={root.defaultExpansionState === "collapsed" ? false : true}
            actionHandler={actionHandler}
          />
        ))}
      </FieldGrid>
    </Stack>
  );
}
