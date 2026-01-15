// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { Button, Link, Tab, Tabs, Typography, Divider } from "@mui/material";
import DOMPurify from "dompurify";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";
import { useAsync, useMountedState } from "react-use";
import { makeStyles } from "tss-react/mui";

import { Immutable } from "@lichtblick/suite";
import Stack from "@lichtblick/suite-base/components/Stack";
import TextContent from "@lichtblick/suite-base/components/TextContent";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";
import { isValidUrl } from "@lichtblick/suite-base/util/isValidURL";

type Props = {
  installed: boolean;
  extension: Immutable<ExtensionMarketplaceDetail>;
  onClose: () => void;
};

const useStyles = makeStyles()((theme) => ({
  backButton: {
    marginLeft: theme.spacing(-1.5),
    marginBottom: theme.spacing(1),
  },
  installButton: {
    minWidth: 100,
  },
}));

enum OperationStatus {
  IDLE = "idle",
  INSTALLING = "installing",
  UNINSTALLING = "uninstalling",
}

/**
 * ExtensionDetails component displays detailed information about a specific extension.
 * It allows users to install, uninstall, and view the README and CHANGELOG of the extension.
 *
 * @param {Object} props - The component props.
 * @param {boolean} props.installed - Indicates if the extension is already installed.
 * @param {Immutable<ExtensionMarketplaceDetail>} props.extension - The extension details.
 * @param {Function} props.onClose - Callback function to close the details view.
 * @returns {React.ReactElement} The rendered component.
 */
export function ExtensionDetails({
  extension,
  onClose,
  installed,
}: Readonly<Props>): React.ReactElement {
  const { classes } = useStyles();
  const [isInstalled, setIsInstalled] = useState(installed);
  const [operationStatus, setOperationStatus] = useState<OperationStatus>(OperationStatus.IDLE);
  const [activeTab, setActiveTab] = useState<number>(0);
  const isMounted = useMountedState();
  const downloadExtension = useExtensionCatalog((state) => state.downloadExtension);
  const installExtensions = useExtensionCatalog((state) => state.installExtensions);
  const uninstallExtension = useExtensionCatalog((state) => state.uninstallExtension);
  const marketplace = useExtensionMarketplace();
  const { enqueueSnackbar } = useSnackbar();
  const readme = extension.readme;
  const changelog = extension.changelog;
  const canInstall = extension.foxe != undefined;

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

  const analytics = useAnalytics();

  /**
   * Handles the download and installation of the extension.
   *
   * @async
   * @function downloadAndInstall
   * @returns {Promise<void>}
   */
  const downloadAndInstall = useCallback(async () => {
    if (!isDesktopApp()) {
      enqueueSnackbar("Download the desktop app to use marketplace extensions.", {
        variant: "error",
      });
      return;
    }

    const url = extension.foxe;
    if (url == undefined) {
      enqueueSnackbar(`Cannot install extension ${extension.id}, "foxe" URL is missing`, {
        variant: "error",
      });
      return;
    }

    setOperationStatus(OperationStatus.INSTALLING);

    try {
      const extensionBuffer = await downloadExtension(url);
      await installExtensions("local", [{ buffer: extensionBuffer }]);

      enqueueSnackbar(`${extension.name} installed successfully`, { variant: "success" });

      if (isMounted()) {
        setIsInstalled(true);
        void analytics.logEvent(AppEvent.EXTENSION_INSTALL, { type: extension.id });
      }
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "Failed to install extension", {
        variant: "error",
      });
    } finally {
      setOperationStatus(OperationStatus.IDLE);
    }
  }, [
    analytics,
    downloadExtension,
    enqueueSnackbar,
    extension.foxe,
    extension.id,
    extension.name,
    installExtensions,
    isMounted,
  ]);

  /**
   * Handles the uninstallation of the extension.
   *
   * @async
   * @function uninstall
   * @returns {Promise<void>}
   */
  const uninstall = useCallback(async () => {
    setOperationStatus(OperationStatus.UNINSTALLING);

    try {
      // UX - Avoids the button from blinking when operation completes too fast
      await new Promise((resolve) => setTimeout(resolve, 200));
      await uninstallExtension(extension.namespace ?? "local", extension.id);
      enqueueSnackbar(`${extension.name} uninstalled successfully`, { variant: "success" });

      if (isMounted()) {
        setIsInstalled(false);
        void analytics.logEvent(AppEvent.EXTENSION_UNINSTALL, { type: extension.id });
      }
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "Failed to uninstall extension", {
        variant: "error",
      });
    } finally {
      setOperationStatus(OperationStatus.IDLE);
    }
  }, [
    analytics,
    enqueueSnackbar,
    extension.id,
    extension.name,
    extension.namespace,
    isMounted,
    uninstallExtension,
  ]);

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
          </Stack>
          <Typography variant="subtitle2" gutterBottom>
            {extension.publisher}
          </Typography>
          <Typography variant="body2" gutterBottom>
            {extension.description}
          </Typography>
        </Stack>
        {isInstalled ? (
          <Button
            className={classes.installButton}
            size="small"
            key="uninstall"
            color="inherit"
            variant="contained"
            onClick={uninstall}
            disabled={operationStatus !== OperationStatus.IDLE}
          >
            {operationStatus === OperationStatus.UNINSTALLING ? "Uninstalling..." : "Uninstall"}
          </Button>
        ) : (
          canInstall && (
            <Button
              className={classes.installButton}
              size="small"
              key="install"
              color="inherit"
              variant="contained"
              onClick={downloadAndInstall}
              disabled={operationStatus !== "idle"}
            >
              {operationStatus === OperationStatus.INSTALLING ? "Installing..." : "Install"}
            </Button>
          )
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
