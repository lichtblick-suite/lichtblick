// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  styled as muiStyled,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useAsync } from "react-use";

import { ExtensionDetails } from "@foxglove/studio-base/components/ExtensionDetails";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import { useExtensionLoader } from "@foxglove/studio-base/context/ExtensionLoaderContext";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";

import helpContent from "./index.help.md";

const StyledListItemButton = muiStyled(ListItemButton)(({ theme }) => ({
  "&:hover": {
    color: theme.palette.primary.main,
  },
}));

function ExtensionListEntry(props: {
  entry: ExtensionMarketplaceDetail;
  onClick: () => void;
}): JSX.Element {
  const {
    entry: { id, description, name, publisher, version },
    onClick,
  } = props;
  return (
    <ListItem disablePadding key={id}>
      <StyledListItemButton onClick={onClick}>
        <ListItemText
          disableTypography
          primary={
            <Stack direction="row" alignItems="baseline" gap={0.5}>
              <Typography variant="subtitle2" fontWeight={600}>
                {name}
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
      </StyledListItemButton>
    </ListItem>
  );
}

export default function ExtensionsSidebar(): React.ReactElement {
  const [shouldFetch, setShouldFetch] = useState<boolean>(true);
  const [marketplaceEntries, setMarketplaceEntries] = useState<ExtensionMarketplaceDetail[]>([]);
  const [focusedExtension, setFocusedExtension] = useState<
    | {
        installed: boolean;
        entry: ExtensionMarketplaceDetail;
      }
    | undefined
  >(undefined);
  const extensionLoader = useExtensionLoader();
  const marketplace = useExtensionMarketplace();

  const { value: installed, error: installedError } = useAsync(
    async () => await extensionLoader.getExtensions(),
    [extensionLoader],
  );

  if (installedError) {
    throw installedError;
  }

  const { error: availableError } = useAsync(async () => {
    if (!shouldFetch) {
      return;
    }
    setShouldFetch(false);

    const entries = await marketplace.getAvailableExtensions();
    setMarketplaceEntries(entries);
  }, [marketplace, shouldFetch]);

  const marketplaceMap = useMemo(() => {
    return new Map<string, ExtensionMarketplaceDetail>(
      marketplaceEntries.map((entry) => [entry.id, entry]),
    );
  }, [marketplaceEntries]);

  const installedEntries = useMemo<ExtensionMarketplaceDetail[]>(
    () =>
      (installed ?? []).map((entry) => {
        const marketplaceEntry = marketplaceMap.get(entry.id);
        if (marketplaceEntry != undefined) {
          return marketplaceEntry;
        }

        return {
          id: entry.id,
          installed: true,
          name: entry.displayName,
          description: entry.description,
          publisher: entry.publisher,
          homepage: entry.homepage,
          license: entry.license,
          version: entry.version,
          keywords: entry.keywords,
        };
      }),
    [installed, marketplaceMap],
  );

  // Hide installed extensions from the list of available extensions
  const filteredMarketplaceEntries = useMemo(() => {
    const installedIds = new Set<string>(installed?.map((entry) => entry.id));
    return marketplaceEntries.filter((entry) => !installedIds.has(entry.id));
  }, [marketplaceEntries, installed]);

  if (focusedExtension != undefined) {
    return (
      <ExtensionDetails
        installed={focusedExtension.installed}
        extension={focusedExtension.entry}
        onClose={() => setFocusedExtension(undefined)}
      />
    );
  }

  if (availableError) {
    return (
      <SidebarContent title="Extensions">
        <Stack gap={1} alignItems="center" justifyContent="center" fullHeight>
          <Typography align="center" variant="body2" color="text.secondary">
            Failed to fetch the list of available extensions. Check your Internet connection and try
            again.
          </Typography>
          <Button onClick={() => setShouldFetch(true)}>Retry Fetching Extensions</Button>
        </Stack>
      </SidebarContent>
    );
  }

  return (
    <SidebarContent title="Extensions" helpContent={helpContent} disablePadding>
      <Stack gap={1}>
        <List>
          <Stack paddingY={0.25} paddingX={2}>
            <Typography component="li" variant="overline" color="text.secondary">
              Installed
            </Typography>
          </Stack>
          {installedEntries.length > 0 ? (
            installedEntries.map((entry) => (
              <ExtensionListEntry
                key={entry.id}
                entry={entry}
                onClick={() => setFocusedExtension({ installed: true, entry })}
              />
            ))
          ) : (
            <ListItem>
              <ListItemText primary="No installed extensions" />
            </ListItem>
          )}
        </List>
        <List>
          <Stack paddingY={0.25} paddingX={2}>
            <Typography component="li" variant="overline" color="text.secondary">
              Available
            </Typography>
          </Stack>
          {filteredMarketplaceEntries.map((entry) => (
            <ExtensionListEntry
              key={entry.id}
              entry={entry}
              onClick={() => setFocusedExtension({ installed: false, entry })}
            />
          ))}
        </List>
      </Stack>
    </SidebarContent>
  );
}
