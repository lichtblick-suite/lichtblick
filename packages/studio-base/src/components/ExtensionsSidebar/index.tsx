// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageBar, MessageBarType, Stack, useTheme, makeStyles } from "@fluentui/react";
import { useMemo, useState } from "react";
import { useAsync } from "react-use";

import Button from "@foxglove/studio-base/components/Button";
import { ExtensionDetails } from "@foxglove/studio-base/components/ExtensionDetails";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useExtensionLoader } from "@foxglove/studio-base/context/ExtensionLoaderContext";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";

import helpContent from "./index.help.md";

const useStyles = makeStyles((theme) => ({
  name: {
    fontWeight: "bold",
  },
  version: {
    color: theme.palette.neutralSecondaryAlt,
    fontSize: "80%",
    marginLeft: 8,
  },
  description: {
    color: theme.palette.neutralSecondaryAlt,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    width: "100%",
    display: "inline-block",
    overflow: "hidden",
  },
  publisher: {
    color: theme.semanticColors.bodyText,
  },
  sectionHeader: {
    ...theme.fonts.xSmall,
    display: "block",
    textTransform: "uppercase",
    color: theme.palette.neutralSecondaryAlt,
    letterSpacing: "0.025em",
    marginBottom: theme.spacing.s1,
  },
}));

export default function ExtensionsSidebar(): React.ReactElement {
  const theme = useTheme();
  const classes = useStyles();
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
          name: entry.name,
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
    return <FetchError onRetry={() => setShouldFetch(true)}></FetchError>;
  }

  return (
    <SidebarContent title="Extensions" helpContent={helpContent}>
      <Stack tokens={{ childrenGap: 30 }}>
        <Stack.Item>
          <h2 className={classes.sectionHeader}>Installed</h2>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            {installedEntries.length > 0
              ? installedEntries.map((entry) => (
                  <ExtensionListEntry
                    key={entry.id}
                    entry={entry}
                    onClick={() =>
                      setFocusedExtension({
                        installed: true,
                        entry,
                      })
                    }
                  />
                ))
              : "No installed extensions"}
          </Stack>
        </Stack.Item>
        <Stack.Item>
          <h2 className={classes.sectionHeader}>Available</h2>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            {filteredMarketplaceEntries.map((entry) => (
              <ExtensionListEntry
                key={entry.id}
                entry={entry}
                onClick={() =>
                  setFocusedExtension({
                    installed: false,
                    entry,
                  })
                }
              />
            ))}
          </Stack>
        </Stack.Item>
      </Stack>
    </SidebarContent>
  );
}

function ExtensionListEntry(props: {
  entry: ExtensionMarketplaceDetail;
  onClick: () => void;
}): JSX.Element {
  const { entry } = props;
  const theme = useTheme();
  const classes = useStyles();
  return (
    <Stack
      key={entry.id}
      onClick={props.onClick}
      styles={{
        root: {
          margin: `0 -${theme.spacing.m}`,
          borderBottom: `1px solid ${theme.semanticColors.bodyBackground}`,
          borderTop: `1px solid ${theme.semanticColors.bodyBackground}`,

          ":hover": {
            backgroundColor: theme.semanticColors.menuItemBackgroundHovered,
            color: theme.semanticColors.accentButtonBackground,
            cursor: "pointer",
          },
        },
      }}
      tokens={{
        childrenGap: 6,
        padding: `${theme.spacing.s1} ${theme.spacing.m}`,
      }}
    >
      <Stack.Item>
        <span className={classes.name}>{entry.name}</span>
        <span className={classes.version}>{entry.version}</span>
      </Stack.Item>
      <Stack.Item>
        <span className={classes.description}>{entry.description}</span>
      </Stack.Item>
      <Stack.Item>
        <span className={classes.publisher}>{entry.publisher}</span>
      </Stack.Item>
    </Stack>
  );
}

function FetchError(props: { onRetry: () => void }): React.ReactElement {
  const errorMsg =
    "Failed to fetch the list of available extensions. Check your Internet connection and try again.";
  return (
    <SidebarContent title="Extensions">
      <MessageBar
        messageBarType={MessageBarType.error}
        isMultiline={true}
        dismissButtonAriaLabel="Close"
      >
        {errorMsg}
      </MessageBar>
      <Button
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
        onClick={props.onRetry}
      >
        Retry Fetching Extensions
      </Button>
    </SidebarContent>
  );
}
