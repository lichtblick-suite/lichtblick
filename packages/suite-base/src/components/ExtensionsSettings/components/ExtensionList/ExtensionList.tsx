// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { List, ListItem, ListItemText, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { Immutable } from "@lichtblick/suite";
import { FocusedExtension } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";

import ExtensionListEntry from "../ExtensionListEntry/ExtensionListEntry";

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

type ExtensionListProps = {
  namespace: string;
  entries: Immutable<ExtensionMarketplaceDetail>[];
  filterText: string;
  selectExtension: (newFocusedExtension: FocusedExtension) => void;
};

export default function ExtensionList({
  namespace,
  entries,
  filterText,
  selectExtension,
}: ExtensionListProps): React.JSX.Element {
  const { t } = useTranslation("extensionsSettings");

  const renderComponent = () => {
    if (entries.length === 0 && filterText) {
      return generatePlaceholderList(t("noExtensionsFound"));
    } else if (entries.length === 0) {
      return generatePlaceholderList(t("noExtensionsAvailable"));
    }
    return (
      <>
        {entries.map((entry) => (
          <ExtensionListEntry
            key={entry.id}
            entry={entry}
            onClick={() => {
              selectExtension({ installed: true, entry });
            }}
            searchText={filterText}
          />
        ))}
      </>
    );
  };

  return (
    <List key={namespace}>
      <Stack paddingY={0} paddingX={2}>
        <Typography component="li" variant="overline" color="text.secondary">
          {displayNameForNamespace(namespace)}
        </Typography>
      </Stack>
      {renderComponent()}
    </List>
  );
}
