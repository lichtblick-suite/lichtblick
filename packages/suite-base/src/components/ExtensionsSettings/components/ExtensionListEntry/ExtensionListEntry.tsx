// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ListItem, ListItemButton, ListItemText, Typography } from "@mui/material";

import { Immutable } from "@lichtblick/suite";
import Stack from "@lichtblick/suite-base/components/Stack";
import TextHighlight from "@lichtblick/suite-base/components/TextHighlight";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";

import { useStyles } from "./ExtensionListEntry.style";

type Props = {
  entry: Immutable<ExtensionMarketplaceDetail>;
  onClick: () => void;
  searchText: string;
};

export default function ExtensionListEntry({
  entry: { id, description, name, publisher, version },
  searchText,
  onClick,
}: Props): React.JSX.Element {
  const { classes } = useStyles();
  return (
    <ListItem disablePadding key={id} data-testid="extension-list-entry">
      <ListItemButton className={classes.listItemButton} onClick={onClick}>
        <ListItemText
          disableTypography
          primary={
            <Stack direction="row" alignItems="baseline" gap={0.5}>
              <Typography variant="subtitle2" fontWeight={600}>
                <TextHighlight targetStr={name} searchText={searchText} />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {version}
              </Typography>
            </Stack>
          }
          secondary={
            <Stack gap={0.5}>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
              <Typography color="text.primary" variant="body2">
                {publisher}
              </Typography>
            </Stack>
          }
        />
      </ListItemButton>
    </ListItem>
  );
}
