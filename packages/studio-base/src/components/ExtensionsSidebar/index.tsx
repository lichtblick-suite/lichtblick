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
import { differenceWith, groupBy, isEmpty, keyBy } from "lodash";
import { useEffect, useMemo, useState } from "react";
import { useAsyncFn } from "react-use";
import { DeepReadonly } from "ts-essentials";

import Log from "@foxglove/log";
import { ExtensionDetails } from "@foxglove/studio-base/components/ExtensionDetails";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import { useExtensionCatalog } from "@foxglove/studio-base/context/ExtensionCatalogContext";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";

const log = Log.getLogger(__filename);

const StyledListItemButton = muiStyled(ListItemButton)(({ theme }) => ({
  "&:hover": {
    color: theme.palette.primary.main,
  },
}));

function displayNameForNamespace(namespace: string): string {
  switch (namespace) {
    case "org":
      return "Organization";
    default:
      return namespace;
  }
}

function ExtensionListEntry(props: {
  entry: DeepReadonly<ExtensionMarketplaceDetail>;
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
  const [focusedExtension, setFocusedExtension] = useState<
    | {
        installed: boolean;
        entry: DeepReadonly<ExtensionMarketplaceDetail>;
      }
    | undefined
  >(undefined);
  const installed = useExtensionCatalog((state) => state.installedExtensions);
  const marketplace = useExtensionMarketplace();

  const [marketplaceEntries, refreshMarketplaceEntries] = useAsyncFn(
    async () => await marketplace.getAvailableExtensions(),
    [marketplace],
  );

  const marketplaceMap = useMemo(
    () => keyBy(marketplaceEntries.value ?? [], (entry) => entry.id),
    [marketplaceEntries],
  );

  const installedEntries = useMemo(
    () =>
      (installed ?? []).map((entry) => {
        const marketplaceEntry = marketplaceMap[entry.id];
        if (marketplaceEntry != undefined) {
          return { ...marketplaceEntry, namespace: entry.namespace };
        }

        return {
          id: entry.id,
          installed: true,
          name: entry.displayName,
          displayName: entry.displayName,
          description: entry.description,
          publisher: entry.publisher,
          homepage: entry.homepage,
          license: entry.license,
          version: entry.version,
          keywords: entry.keywords,
          namespace: entry.namespace,
          qualifiedName: entry.qualifiedName,
        };
      }),
    [installed, marketplaceMap],
  );

  const namespacedEntries = useMemo(
    () => groupBy(installedEntries, (entry) => entry.namespace),
    [installedEntries],
  );

  // Hide installed extensions from the list of available extensions
  const filteredMarketplaceEntries = useMemo(
    () =>
      differenceWith(
        marketplaceEntries.value ?? [],
        installed ?? [],
        (a, b) => a.id === b.id && a.namespace === b.namespace,
      ),
    [marketplaceEntries, installed],
  );

  useEffect(() => {
    refreshMarketplaceEntries().catch((error) => log.error(error));
  }, [refreshMarketplaceEntries]);

  if (focusedExtension != undefined) {
    return (
      <ExtensionDetails
        installed={focusedExtension.installed}
        extension={focusedExtension.entry}
        onClose={() => setFocusedExtension(undefined)}
      />
    );
  }

  if (marketplaceEntries.error) {
    return (
      <SidebarContent title="Extensions">
        <Stack gap={1} alignItems="center" justifyContent="center" fullHeight>
          <Typography align="center" variant="body2" color="text.secondary">
            Failed to fetch the list of available extensions. Check your Internet connection and try
            again.
          </Typography>
          <Button onClick={async () => await refreshMarketplaceEntries()}>
            Retry Fetching Extensions
          </Button>
        </Stack>
      </SidebarContent>
    );
  }

  return (
    <SidebarContent title="Extensions" disablePadding>
      <Stack gap={1}>
        {!isEmpty(namespacedEntries) ? (
          Object.entries(namespacedEntries).map(([namespace, entries]) => (
            <List key={namespace}>
              <Stack paddingY={0.25} paddingX={2}>
                <Typography component="li" variant="overline" color="text.secondary">
                  {displayNameForNamespace(namespace)}
                </Typography>
              </Stack>
              {entries.map((entry) => (
                <ExtensionListEntry
                  key={`${entry.id}`}
                  entry={entry}
                  onClick={() => setFocusedExtension({ installed: true, entry })}
                />
              ))}
            </List>
          ))
        ) : (
          <List>
            <ListItem>
              <ListItemText primary="No installed extensions" />
            </ListItem>
          </List>
        )}
        <List>
          <Stack paddingY={0.25} paddingX={2}>
            <Typography component="li" variant="overline" color="text.secondary">
              Available
            </Typography>
          </Stack>
          {filteredMarketplaceEntries.map((entry) => (
            <ExtensionListEntry
              key={`${entry.id}_${entry.namespace}`}
              entry={entry}
              onClick={() => setFocusedExtension({ installed: false, entry })}
            />
          ))}
        </List>
      </Stack>
    </SidebarContent>
  );
}
