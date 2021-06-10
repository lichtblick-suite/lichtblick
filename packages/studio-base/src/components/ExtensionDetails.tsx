// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, Pivot, PivotItem } from "@fluentui/react";
import { useAsync } from "react-use";
import styled from "styled-components";

import Button from "@foxglove/studio-base/components/Button";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import TextContent from "@foxglove/studio-base/components/TextContent";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@foxglove/studio-base/context/ExtensionMarketplaceContext";

type Props = {
  extension: ExtensionMarketplaceDetail;
  onClose: () => void;
};

const ExtensionId = styled.a`
  border-radius: 3px;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 3px;
  text-decoration: none;
`;

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

export function ExtensionDetails({ extension, onClose }: Props): React.ReactElement {
  const marketplace = useExtensionMarketplace();
  const readmeUrl = extension.readme;
  const changelogUrl = extension.changelog;

  const { value: readmeContent } = useAsync(
    async () => (readmeUrl != undefined ? await marketplace.getMarkdown(readmeUrl) : ""),
    [marketplace, readmeUrl],
  );
  const { value: changelogContent } = useAsync(
    async () => (changelogUrl != undefined ? await marketplace.getMarkdown(changelogUrl) : ""),
    [marketplace, changelogUrl],
  );

  return (
    <SidebarContent title={extension.name} paddingLeft="32px">
      <ActionButton
        iconProps={{ iconName: "ChevronLeft" }}
        style={{ position: "absolute", top: "5px", left: "8px" }}
        onClick={onClose}
      ></ActionButton>
      <ExtensionId href={extension.homepage} target="_blank">
        {extension.id}
      </ExtensionId>
      <Version>{`v${extension.version}`}</Version>
      <License>{extension.license}</License>
      <Publisher>{extension.publisher}</Publisher>
      <Description>{extension.description}</Description>
      {extension.installed === true ? <UninstallButton /> : <InstallButton />}
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

function UninstallButton(): React.ReactElement {
  return (
    <Button style={{ minWidth: "100px" }} onClick={() => {}}>
      Uninstall
    </Button>
  );
}

function InstallButton(): React.ReactElement {
  return (
    <Button style={{ minWidth: "100px" }} onClick={() => {}}>
      Install
    </Button>
  );
}
