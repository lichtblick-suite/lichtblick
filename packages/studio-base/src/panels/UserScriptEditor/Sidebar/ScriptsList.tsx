// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddIcon from "@mui/icons-material/Add";
import { Button, List } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { UserScript, UserScripts } from "@foxglove/studio-base/types/panels";

import { ScriptListItem } from "./ScriptListItem";
import { SidebarHeader } from "./SidebarHeader";

const useStyles = makeStyles()((theme) => ({
  buttonRow: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1, 1.125),
  },
}));

type ScriptsListProps = {
  scripts: UserScripts;
  addNewScript: () => void;
  selectScript: (id: string) => void;
  deleteScript: (id: string) => void;
  onClose: () => void;
  selectedScriptId?: string;
  selectedScript?: UserScript;
  setUserScripts: (scripts: Partial<UserScripts>) => void;
};

export function ScriptsList({
  scripts,
  addNewScript,
  selectScript,
  deleteScript,
  onClose,
  selectedScriptId,
  selectedScript,
  setUserScripts,
}: ScriptsListProps): JSX.Element {
  const { classes } = useStyles();

  return (
    <Stack flex="auto">
      <SidebarHeader title="Scripts" onClose={onClose} />
      <List>
        {Object.keys(scripts).map((scriptId) => {
          return (
            <ScriptListItem
              key={scriptId}
              title={scripts[scriptId]?.name ?? "Untitled script"}
              selected={selectedScriptId === scriptId}
              onClick={() => {
                selectScript(scriptId);
              }}
              onDelete={() => {
                deleteScript(scriptId);
              }}
              onRename={(name: string) => {
                if (selectedScriptId != undefined && selectedScript != undefined) {
                  setUserScripts({
                    ...scripts,
                    [selectedScriptId]: { ...selectedScript, name },
                  });
                }
              }}
            />
          );
        })}
        <li className={classes.buttonRow}>
          <Button
            fullWidth
            startIcon={<AddIcon />}
            variant="contained"
            color="inherit"
            onClick={() => {
              addNewScript();
            }}
          >
            New script
          </Button>
        </li>
      </List>
    </Stack>
  );
}
