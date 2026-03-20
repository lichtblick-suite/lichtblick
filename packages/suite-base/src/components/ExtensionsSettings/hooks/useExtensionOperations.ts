// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import { Immutable } from "@lichtblick/suite";
import {
  UseExtensionOperationsOptions,
  UseExtensionOperationsReturnHook,
} from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import { OperationStatus } from "@lichtblick/suite-base/components/types";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

/**
 * Custom hook for handling extension install/uninstall operations.
 * Encapsulates the common logic for downloading, installing, and uninstalling extensions.
 *
 * @param {UseExtensionOperationsOptions} options - Optional callbacks for success events
 * @returns {UseExtensionOperationsReturnHook} Extension operation handlers and state
 */
export function useExtensionOperations(
  options: UseExtensionOperationsOptions = {},
): UseExtensionOperationsReturnHook {
  const { onInstallSuccess, onUninstallSuccess } = options;
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
        onInstallSuccess?.(extension.id);
      } catch (error) {
        enqueueSnackbar(error instanceof Error ? error.message : "Failed to install extension", {
          variant: "error",
        });
      } finally {
        setOperatingExtensionId(undefined);
        setOperationStatus(OperationStatus.IDLE);
      }
    },
    [analytics, downloadExtension, enqueueSnackbar, installExtensions, onInstallSuccess],
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
        onUninstallSuccess?.(extension.id);
      } catch (error) {
        enqueueSnackbar(error instanceof Error ? error.message : "Failed to uninstall extension", {
          variant: "error",
        });
      } finally {
        setOperatingExtensionId(undefined);
        setOperationStatus(OperationStatus.IDLE);
      }
    },
    [analytics, enqueueSnackbar, onUninstallSuccess, uninstallExtension],
  );

  const isOperating = useCallback(
    (extensionId: string) => operatingExtensionId === extensionId,
    [operatingExtensionId],
  );

  return {
    handleInstall,
    handleUninstall,
    operationStatus,
    operatingExtensionId,
    isOperating,
  };
}
