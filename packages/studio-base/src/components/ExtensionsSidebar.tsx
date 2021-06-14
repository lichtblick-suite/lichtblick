// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyles, MessageBar, MessageBarType, Stack, useTheme } from "@fluentui/react";
import { useMemo, useState } from "react";
import { useAsync } from "react-use";
import styled from "styled-components";

import Button from "@foxglove/studio-base/components/Button";
import { SectionHeader } from "@foxglove/studio-base/components/Menu";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useExtensionLoader } from "@foxglove/studio-base/context/ExtensionLoaderContext";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";

import { ExtensionDetails } from "./ExtensionDetails";

const ListItemStyles = mergeStyles({
  marginLeft: "-16px",
  marginRight: "-16px",
  paddingLeft: "16px",
  paddingRight: "16px",
  selectors: {
    ":hover": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      cursor: "pointer",
    },
  },
});

const Name = styled.span`
  color: #8b888f;
  font-weight: bold;
`;

const NameLine = styled.div`
  margin-top: 6px;
`;

const Version = styled.span`
  color: #7a777d;
  font-size: 80%;
  margin-left: 8px;
`;

const Description = styled.span`
  color: #8b888f;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  display: inline-block;
  overflow: hidden;
`;

const DescriptionLine = styled.div`
  margin-top: 6px;
`;

const Publisher = styled.span`
  color: #e2dce9;
`;

const PublisherLine = styled.div`
  margin-top: 4px;
  margin-bottom: 10px;
`;

export default function ExtensionsSidebar(): React.ReactElement {
  const theme = useTheme();

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
    <SidebarContent title="Extensions">
      <Stack tokens={{ childrenGap: 30 }}>
        <Stack.Item>
          <SectionHeader>Installed</SectionHeader>
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
          <SectionHeader>Available</SectionHeader>
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
  return (
    <Stack.Item key={entry.id} className={ListItemStyles} onClick={props.onClick}>
      <NameLine>
        <Name>{entry.name}</Name>
        <Version>{entry.version}</Version>
      </NameLine>
      <DescriptionLine>
        <Description>{entry.description}</Description>
      </DescriptionLine>
      <PublisherLine>
        <Publisher>{entry.publisher}</Publisher>
      </PublisherLine>
    </Stack.Item>
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
