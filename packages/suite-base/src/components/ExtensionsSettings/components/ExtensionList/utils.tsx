// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { List, ListItem, ListItemText } from "@mui/material";

export function displayNameForNamespace(namespace: string): string {
  if (namespace === "org") {
    return "Organization";
  } else {
    return namespace;
  }
}

export function generatePlaceholderList(message?: string): React.ReactElement {
  return (
    <List>
      <ListItem>
        <ListItemText primary={message} />
      </ListItem>
    </List>
  );
}
