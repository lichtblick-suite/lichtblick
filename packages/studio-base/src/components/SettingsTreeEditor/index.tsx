// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { AppBar, IconButton, TextField, styled as muiStyled, List } from "@mui/material";
import { useState } from "react";
import { DeepReadonly } from "ts-essentials";

import Stack from "@foxglove/studio-base/components/Stack";

import { NodeEditor } from "./NodeEditor";
import { SettingsTree } from "./types";

const StyledAppBar = muiStyled(AppBar, { skipSx: true })(({ theme }) => ({
  top: -1,
  zIndex: theme.zIndex.appBar - 1,
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1),
}));

const ROOT_PATH: readonly string[] = [];

export default function SettingsTreeEditor({
  settings,
}: {
  settings: DeepReadonly<SettingsTree>;
}): JSX.Element {
  const { actionHandler } = settings;
  const [filterText, setFilterText] = useState<string>("");

  return (
    <Stack fullHeight>
      {settings.disableFilter !== true && (
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
      <List dense disablePadding>
        <NodeEditor path={ROOT_PATH} settings={settings.settings} actionHandler={actionHandler} />
      </List>
    </Stack>
  );
}
