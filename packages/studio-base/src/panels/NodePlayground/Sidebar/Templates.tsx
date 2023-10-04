// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { List, ListItem, ListItemButton, ListItemText } from "@mui/material";

import Stack from "@foxglove/studio-base/components/Stack";
import templates from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/templates";

import { SidebarHeader } from "./SidebarHeader";

export function Templates({
  onClose,
  addNewNode,
}: {
  onClose: () => void;
  addNewNode: (template?: string) => void;
}): JSX.Element {
  return (
    <Stack flex="auto">
      <SidebarHeader
        title="Templates"
        subheader="Create scripts from these templates, click a template to create a new script."
        onClose={onClose}
      />
      <List dense>
        {templates.map(({ name, description, template }) => (
          <ListItem
            disablePadding
            key={name}
            onClick={() => {
              addNewNode(template);
            }}
          >
            <ListItemButton>
              <ListItemText
                primary={name}
                secondary={description}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
