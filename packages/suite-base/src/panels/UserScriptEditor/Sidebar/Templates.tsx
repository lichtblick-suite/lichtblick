// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { List, ListItem, ListItemButton, ListItemText } from "@mui/material";

import Stack from "@lichtblick/suite-base/components/Stack";
import templates from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/templates";

import { SidebarHeader } from "./SidebarHeader";

export function Templates({
  onClose,
  addNewNode,
}: {
  onClose: () => void;
  addNewNode: (template?: string) => void;
}): React.JSX.Element {
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
                slotProps={{ secondary: { variant: "caption" } }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
