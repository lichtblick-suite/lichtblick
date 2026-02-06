// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { Button, List, ListItem, ListItemText, Typography } from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { Immutable } from "@lichtblick/suite";
import { FocusedExtension } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import { OperationStatus } from "@lichtblick/suite-base/components/types";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

const paginationModel = {
  pageSize: 10,
  page: 0,
};

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
}: Readonly<ExtensionListProps>): React.JSX.Element {
  const { t } = useTranslation("extensionsSettings");
  const installedExtensions = useExtensionCatalog((state) => state.installedExtensions);
  const downloadExtension = useExtensionCatalog((state) => state.downloadExtension);
  const installExtensions = useExtensionCatalog((state) => state.installExtensions);
  const uninstallExtension = useExtensionCatalog((state) => state.uninstallExtension);
  const { enqueueSnackbar } = useSnackbar();
  const analytics = useAnalytics();
  const [operatingExtensionId, setOperatingExtensionId] = useState<string | undefined>();
  const [operationStatus, setOperationStatus] = useState<OperationStatus>(OperationStatus.IDLE);

  const handleInstall = useCallback(
    async (extension: Immutable<ExtensionMarketplaceDetail>) => {
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

      setOperatingExtensionId(extension.id);
      setOperationStatus(OperationStatus.INSTALLING);

      try {
        const extensionBuffer = await downloadExtension(url);
        await installExtensions("local", [{ buffer: extensionBuffer }]);
        enqueueSnackbar(`${extension.name} installed successfully`, { variant: "success" });
        await analytics.logEvent(AppEvent.EXTENSION_INSTALL, { type: extension.id });
      } catch (error) {
        enqueueSnackbar(error instanceof Error ? error.message : "Failed to install extension", {
          variant: "error",
        });
      } finally {
        setOperatingExtensionId(undefined);
        setOperationStatus(OperationStatus.IDLE);
      }
    },
    [analytics, downloadExtension, enqueueSnackbar, installExtensions],
  );

  const handleUninstall = useCallback(
    async (extension: Immutable<ExtensionMarketplaceDetail>) => {
      setOperatingExtensionId(extension.id);
      setOperationStatus(OperationStatus.UNINSTALLING);

      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await uninstallExtension(extension.namespace ?? "local", extension.id);
        enqueueSnackbar(`${extension.name} uninstalled successfully`, { variant: "success" });
        await analytics.logEvent(AppEvent.EXTENSION_UNINSTALL, { type: extension.id });
      } catch (error) {
        enqueueSnackbar(error instanceof Error ? error.message : "Failed to uninstall extension", {
          variant: "error",
        });
      } finally {
        setOperatingExtensionId(undefined);
        setOperationStatus(OperationStatus.IDLE);
      }
    },
    [analytics, enqueueSnackbar, uninstallExtension],
  );

  const columns: GridColDef[] = [
    { field: "name", headerName: "Name", flex: 1, sortable: true },
    { field: "version", headerName: "Version", width: 100 },
    { field: "publisher", headerName: "Publisher", flex: 1 },
    { field: "description", headerName: "Description", flex: 2 },
    {
      field: "actions",
      headerName: "Actions",
      width: 130,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const extension = params.row as ExtensionMarketplaceDetail;
        const isInstalled = installedExtensions
          ? installedExtensions.some((installed) => installed.id === extension.id)
          : false;
        const isOperating = operatingExtensionId === extension.id;
        const canInstall = extension.foxe != undefined;

        if (isInstalled) {
          return (
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              onClick={async (event) => {
                event.stopPropagation();
                await handleUninstall(extension);
              }}
              disabled={isOperating}
            >
              {isOperating && operationStatus === OperationStatus.UNINSTALLING
                ? "Uninstalling..."
                : "Uninstall"}
            </Button>
          );
        } else if (canInstall) {
          return (
            <Button
              size="small"
              color="primary"
              variant="contained"
              onClick={async (event) => {
                event.stopPropagation();
                await handleInstall(extension);
              }}
              disabled={isOperating}
            >
              {isOperating && operationStatus === OperationStatus.INSTALLING
                ? "Installing..."
                : "Install"}
            </Button>
          );
        }
        return undefined;
      },
    },
  ];

  const renderComponent = () => {
    if (entries.length === 0 && filterText) {
      return generatePlaceholderList(t("noExtensionsFound"));
    } else if (entries.length === 0) {
      return generatePlaceholderList(t("noExtensionsAvailable"));
    }
    return (
      <div style={{ width: "100%" }}>
        <DataGrid
          rows={entries}
          columns={columns}
          initialState={{ pagination: { paginationModel } }}
          pageSizeOptions={[5, 10, 20]}
          disableRowSelectionOnClick
          style={{ cursor: "pointer" }}
          onRowClick={(params) => {
            const extension = params.row as ExtensionMarketplaceDetail;
            const isInstalled = installedExtensions
              ? installedExtensions.some((installed) => installed.id === extension.id)
              : false;
            selectExtension({ installed: isInstalled, entry: extension });
          }}
          autoHeight
        />
      </div>
    );
  };

  return (
    <Stack key={namespace} gap={1} paddingBottom={2}>
      <Stack paddingY={0} paddingX={2}>
        <Typography component="div" variant="overline" color="text.secondary">
          {displayNameForNamespace(namespace)}
        </Typography>
      </Stack>
      {renderComponent()}
    </Stack>
  );
}
