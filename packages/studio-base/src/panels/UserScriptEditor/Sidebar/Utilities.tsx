// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { List, ListItem, ListItemButton, ListItemText } from "@mui/material";

import Stack from "@foxglove/studio-base/components/Stack";
import { Script } from "@foxglove/studio-base/panels/UserScriptEditor/script";
import { getUserScriptProjectConfig } from "@foxglove/studio-base/players/UserScriptPlayer/transformerWorker/typescript/projectConfig";

import { SidebarHeader } from "./SidebarHeader";

const { utilityFiles } = getUserScriptProjectConfig();

export function Utilities({
  onClose,
  gotoUtils,
  script,
}: {
  onClose: () => void;
  gotoUtils: (filePath: string) => void;
  script?: Script;
}): JSX.Element {
  return (
    <Stack flex="auto" position="relative">
      <SidebarHeader
        onClose={onClose}
        title="Utilities"
        subheader={
          <>
            You can import any of these modules into your script using the following syntax:{" "}
            <pre>{`import { ... } from "./pointClouds.ts".`}</pre>
          </>
        }
      />
      <List dense>
        {utilityFiles.map(({ fileName, filePath }) => (
          <ListItem disablePadding key={filePath} onClick={gotoUtils.bind(undefined, filePath)}>
            <ListItemButton selected={script ? filePath === script.filePath : undefined}>
              <ListItemText primary={fileName} primaryTypographyProps={{ variant: "body2" }} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem
          disablePadding
          onClick={gotoUtils.bind(undefined, "/studio_script/generatedTypes.ts")}
        >
          <ListItemButton
            selected={script ? script.filePath === "/studio_script/generatedTypes.ts" : undefined}
          >
            <ListItemText primary="generatedTypes.ts" />
          </ListItemButton>
        </ListItem>
      </List>
    </Stack>
  );
}
