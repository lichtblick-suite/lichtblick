// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { Button, Link, Tab, Tabs, Typography, Divider } from "@mui/material";
import DOMPurify from "dompurify";
import { useState } from "react";
import { useAsync, useMountedState } from "react-use";

import { formatByteSize } from "@lichtblick/den/format";
import { useStylesExtensionDetails } from "@lichtblick/suite-base/components/ExtensionDetails.style";
import { InstallButton } from "@lichtblick/suite-base/components/ExtensionsSettings/components/ExtensionActionButton/InstallButton";
import { UninstallButton } from "@lichtblick/suite-base/components/ExtensionsSettings/components/ExtensionActionButton/UninstallButton";
import { useExtensionOperations } from "@lichtblick/suite-base/components/ExtensionsSettings/hooks/useExtensionOperations";
import {
  ExtensionActionsLabel,
  ExtensionOperationStatusLabel,
} from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import TextContent from "@lichtblick/suite-base/components/TextContent";
import { ExtensionDetailsProps, OperationStatus } from "@lichtblick/suite-base/components/types";
import { useExtensionMarketplace } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import { isValidUrl } from "@lichtblick/suite-base/util/isValidURL";

/**
 * ExtensionDetails component displays detailed information about a specific extension.
 * It allows users to install, uninstall, and view the README and CHANGELOG of the extension.
 *
 * @param {Object} props - The component props.
 * @param {boolean} props.installed - Indicates if the extension is already installed.
 * @param {ExtensionMarketplaceDetail} props.extension - The extension details.
 * @param {Function} props.onClose - Callback function to close the details view.
 * @returns {React.ReactElement} The rendered component.
 */
export function ExtensionDetails({
  extension,
  onClose,
  installed,
}: Readonly<ExtensionDetailsProps>): React.ReactElement {
  const { classes } = useStylesExtensionDetails();
  const [isInstalled, setIsInstalled] = useState(installed);
  const [activeTab, setActiveTab] = useState<number>(0);
  const isMounted = useMountedState();
  const marketplace = useExtensionMarketplace();
  const readme = extension.readme;
  const changelog = extension.changelog;

  const { handleInstall, handleUninstall, operationStatus } = useExtensionOperations({
    onInstallSuccess: () => {
      if (isMounted()) {
        setIsInstalled(true);
      }
    },
    onUninstallSuccess: () => {
      if (isMounted()) {
        setIsInstalled(false);
      }
    },
  });

  const { value: readmeContent } = useAsync(
    async () =>
      readme != undefined && isValidUrl(readme)
        ? await marketplace.getMarkdown(readme)
        : DOMPurify.sanitize(readme ?? "No readme found."),
    [marketplace, readme],
  );
  const { value: changelogContent } = useAsync(
    async () =>
      changelog != undefined && isValidUrl(changelog)
        ? await marketplace.getMarkdown(changelog)
        : DOMPurify.sanitize(changelog ?? "No changelog found."),
    [marketplace, changelog],
  );

  return (
    <Stack fullHeight flex="auto" gap={1}>
      <div>
        <Button
          className={classes.backButton}
          onClick={onClose}
          size="small"
          startIcon={<ChevronLeftIcon />}
        >
          Back
        </Button>
        <Typography variant="h3" fontWeight={500}>
          {extension.name}
        </Typography>
      </div>

      <Stack gap={1} alignItems="flex-start">
        <Stack gap={0.5} paddingBottom={1}>
          <Stack direction="row" gap={1} alignItems="baseline">
            <Link
              variant="body2"
              color="primary"
              href={extension.homepage}
              target="_blank"
              underline="hover"
            >
              {extension.id}
            </Link>
            <Typography
              variant="caption"
              color="text.secondary"
            >{`v${extension.version}`}</Typography>
            <Typography variant="caption" color="text.secondary">
              {extension.license}
            </Typography>
            {extension.size != undefined && (
              <Typography variant="caption" color="text.secondary">
                {formatByteSize(extension.size)}
              </Typography>
            )}
          </Stack>
          <Typography variant="subtitle2" gutterBottom>
            {extension.publisher}
          </Typography>
          <Typography variant="body2" gutterBottom>
            {extension.description}
          </Typography>
        </Stack>
        {isInstalled ? (
          <UninstallButton
            extension={extension}
            onAction={handleUninstall}
            isOperating={operationStatus !== OperationStatus.IDLE}
            operationStatus={operationStatus}
            stopPropagation
            label={ExtensionActionsLabel.UNINSTALL}
            loadingLabel={ExtensionOperationStatusLabel.UNINSTALLING}
          />
        ) : (
          <InstallButton
            extension={extension}
            onAction={handleInstall}
            isOperating={operationStatus !== OperationStatus.IDLE}
            operationStatus={operationStatus}
            stopPropagation
            label={ExtensionActionsLabel.INSTALL}
            loadingLabel={ExtensionOperationStatusLabel.INSTALLING}
          />
        )}
      </Stack>

      <Stack paddingTop={2} style={{ marginLeft: -16, marginRight: -16 }}>
        <Tabs
          textColor="inherit"
          value={activeTab}
          onChange={(_event, newValue: number) => {
            setActiveTab(newValue);
          }}
        >
          <Tab disableRipple label="README" value={0} />
          <Tab disableRipple label="CHANGELOG" value={1} />
        </Tabs>
        <Divider />
      </Stack>

      <Stack flex="auto" paddingY={2}>
        {activeTab === 0 && <TextContent>{readmeContent}</TextContent>}
        {activeTab === 1 && <TextContent>{changelogContent}</TextContent>}
      </Stack>
    </Stack>
  );
}
