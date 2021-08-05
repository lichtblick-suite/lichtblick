// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, Link, Pivot, PivotItem } from "@fluentui/react";
import { useCallback, useState } from "react";
import { useToasts } from "react-toast-notifications";
import { useAsync, useMountedState } from "react-use";
import styled from "styled-components";

import Button from "@foxglove/studio-base/components/Button";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import TextContent from "@foxglove/studio-base/components/TextContent";
import { useExtensionLoader } from "@foxglove/studio-base/context/ExtensionLoaderContext";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";

type Props = {
  installed: boolean;
  extension: ExtensionMarketplaceDetail;
  onClose: () => void;
};

const Publisher = styled.div`
  color: #e2dce9;
  margin-top: 8px;
  margin-bottom: 16px;
`;

const Version = styled.span`
  color: #7a777d;
  font-size: 80%;
  margin-left: 8px;
`;

const License = styled.span`
  color: #7a777d;
  font-size: 80%;
  margin-left: 8px;
`;

const Description = styled.div`
  margin-top: 16px;
  margin-bottom: 16px;
`;

export function ExtensionDetails({ extension, onClose, installed }: Props): React.ReactElement {
  const [isInstalled, setIsInstalled] = useState(installed);
  const isMounted = useMountedState();
  const extensionLoader = useExtensionLoader();
  const marketplace = useExtensionMarketplace();
  const { addToast } = useToasts();
  const readmeUrl = extension.readme;
  const changelogUrl = extension.changelog;
  const canInstall = extension.foxe != undefined;

  const { value: readmeContent } = useAsync(
    async () => (readmeUrl != undefined ? await marketplace.getMarkdown(readmeUrl) : ""),
    [marketplace, readmeUrl],
  );
  const { value: changelogContent } = useAsync(
    async () => (changelogUrl != undefined ? await marketplace.getMarkdown(changelogUrl) : ""),
    [marketplace, changelogUrl],
  );

  const install = useCallback(async () => {
    const url = extension.foxe;
    try {
      if (url == undefined) {
        throw new Error(`Cannot install extension ${extension.id}, "foxe" URL is missing`);
      }
      const data = await extensionLoader.downloadExtension(url);
      await extensionLoader.installExtension(data);
      if (isMounted()) {
        setIsInstalled(true);
      }
    } catch (err) {
      addToast(`Failed to download extension ${extension.id}: ${err.message}`, {
        appearance: "error",
      });
    }
  }, [extension.id, extension.foxe, extensionLoader, isMounted, addToast]);

  const uninstall = useCallback(async () => {
    await extensionLoader.uninstallExtension(extension.id);
    if (isMounted()) {
      setIsInstalled(false);
    }
  }, [extension.id, extensionLoader, isMounted]);

  return (
    <SidebarContent
      title={extension.name}
      leadingItems={[
        // eslint-disable-next-line react/jsx-key
        <IconButton iconProps={{ iconName: "ChevronLeft" }} onClick={onClose} />,
      ]}
    >
      <Link href={extension.homepage}>{extension.id}</Link>
      <Version>{`v${extension.version}`}</Version>
      <License>{extension.license}</License>
      <Publisher>{extension.publisher}</Publisher>
      <Description>{extension.description}</Description>
      {isInstalled ? (
        <UninstallButton onClick={uninstall} />
      ) : canInstall ? (
        <InstallButton onClick={install} />
      ) : undefined}
      <Pivot style={{ marginTop: "16px" }}>
        <PivotItem headerText="README">
          <TextContent>{readmeContent}</TextContent>
        </PivotItem>
        <PivotItem headerText="CHANGELOG">
          <TextContent>{changelogContent}</TextContent>
        </PivotItem>
      </Pivot>
    </SidebarContent>
  );
}

function UninstallButton({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <Button style={{ minWidth: "100px" }} onClick={onClick}>
      Uninstall
    </Button>
  );
}

function InstallButton({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <Button style={{ minWidth: "100px" }} onClick={onClick}>
      Install
    </Button>
  );
}
