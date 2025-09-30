// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { nanoid } from "nanoid";
import { SnackbarKey, useSnackbar } from "notistack";
import { useCallback, useEffect, useRef } from "react";

import {
  ExtensionData,
  ExtensionSnackbar,
  InstallExtensionsResult,
  LoadExtensionsResult,
  useExtensionCatalog,
  UseInstallingExtensionsState,
  UseInstallingExtensionsStateProps,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { Namespace } from "@lichtblick/suite-base/types";

import { useInstallingExtensionsStore } from "./useInstallingExtensionsStore";

export function useInstallingExtensionsState({
  isPlaying,
  playerEvents: { play },
}: UseInstallingExtensionsStateProps): UseInstallingExtensionsState {
  const installExtensions = useExtensionCatalog((state) => state.installExtensions);
  const INSTALL_EXTENSIONS_BATCH = 1;

  const { setInstallingProgress, startInstallingProgress, resetInstallingProgress } =
    useInstallingExtensionsStore((state) => ({
      setInstallingProgress: state.setInstallingProgress,
      startInstallingProgress: state.startInstallingProgress,
      resetInstallingProgress: state.resetInstallingProgress,
    }));
  const progress = useInstallingExtensionsStore((state) => state.installingProgress);

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const progressSnackbarKeyRef = useRef<SnackbarKey>(`installing-extensions-${nanoid()}`);
  const progressSnackbarKey = progressSnackbarKeyRef.current;

  // Helper function to format loader failures into user-friendly messages
  const formatFailures = useCallback(
    (
      failedLoaders: Array<
        Pick<LoadExtensionsResult, "loaderType" | "success"> & { error?: unknown }
      >,
    ) => {
      const messages = failedLoaders.map(({ loaderType }) => {
        if (loaderType === "browser") {
          return "not saved to local cache";
        } else if (loaderType === "server") {
          return "not synced to server";
        } else {
          return `${loaderType} failed`;
        }
      });
      return messages.join(", ");
    },
    [],
  );

  useEffect(() => {
    const { installed, total } = progress;
    if (total === 0 || installed === total) {
      closeSnackbar(progressSnackbarKey);
      return;
    }

    enqueueSnackbar(`Installing ${total} extensions...`, {
      key: progressSnackbarKey,
      variant: "info",
      persist: true,
      preventDuplicate: true,
    });
  }, [progress, enqueueSnackbar, closeSnackbar, progressSnackbarKey]);

  const installFoxeExtensions = useCallback(
    async (extensionsData: ExtensionData[]) => {
      startInstallingProgress(extensionsData.length);

      const isPlayingInitialState = isPlaying;

      try {
        const extensionsByNamespace = new Map<Namespace, ExtensionData[]>();

        for (const extension of extensionsData) {
          const namespace = extension.namespace ?? "local";
          const existing = extensionsByNamespace.get(namespace) ?? [];
          existing.push(extension);
          extensionsByNamespace.set(namespace, existing);
        }

        const failedExtensions: Pick<ExtensionSnackbar, "name" | "error" | "namespace">[] = [];
        const warningExtensions: Pick<ExtensionSnackbar, "name" | "warning" | "namespace">[] = [];
        const allResults: Pick<InstallExtensionsResult, "success" | "loaderResults">[] = [];
        let totalSuccessfulInstalls = 0;

        for (const [namespace, extensions] of extensionsByNamespace) {
          for (let i = 0; i < extensions.length; i += INSTALL_EXTENSIONS_BATCH) {
            const chunk = extensions.slice(i, i + INSTALL_EXTENSIONS_BATCH);
            const result = await installExtensions(namespace, chunk);

            // Store all results for later counting
            allResults.push(...result);

            const successfulResults = result.filter(({ success }) => success);
            const failedResults = result.filter(({ success }) => !success);

            totalSuccessfulInstalls += successfulResults.length;

            // Handle successful results that might have warnings (partial failures)
            successfulResults.forEach(({ error, extensionName, loaderResults }) => {
              if (error != undefined && loaderResults) {
                const failedLoaders = loaderResults.filter((loaderResult) => !loaderResult.success);
                const warningMessage = formatFailures(failedLoaders);

                warningExtensions.push({
                  name: extensionName ?? "Unknown extension",
                  warning: `Extension installed successfully, but: ${warningMessage}`,
                  namespace,
                });
              }
            });

            // Collect failed extensions with details
            failedResults.forEach(({ extensionName, loaderResults }) => {
              const errorMessage = loaderResults
                ? `Failed to install "${extensionName}". ${formatFailures(loaderResults.filter((loaderResult) => !loaderResult.success))}`
                : `Failed to install "${extensionName}". Unknown error`;

              failedExtensions.push({
                name: extensionName ?? "Unknown extension",
                error: errorMessage,
                namespace,
              });
            });

            setInstallingProgress((prev) => ({
              ...prev,
              installed: prev.installed + successfulResults.length,
            }));
          }
        }

        // Count failures by loader type from all results
        let cacheFailures = 0;
        let remoteFailures = 0;
        allResults.forEach(({ loaderResults }) => {
          if (loaderResults) {
            const hasIdbFailure = loaderResults.some(
              (loaderResult) => loaderResult.loaderType === "browser" && !loaderResult.success,
            );
            const hasRemoteFailure = loaderResults.some(
              (loaderResult) => loaderResult.loaderType === "server" && !loaderResult.success,
            );

            if (hasIdbFailure) {
              cacheFailures++;
            }
            if (hasRemoteFailure) {
              remoteFailures++;
            }
          }
        });

        setInstallingProgress((prev) => ({
          ...prev,
          inProgress: false,
        }));

        // Show appropriate success/error/warning messages
        if (failedExtensions.length === 0 && warningExtensions.length === 0) {
          enqueueSnackbar(`Successfully installed all ${extensionsData.length} extensions.`, {
            variant: "success",
            preventDuplicate: true,
          });
        } else if (totalSuccessfulInstalls > 0) {
          let message: string = "";
          // Some succeeded, some failed or had warnings
          if (failedExtensions.length > 0) {
            message = `Installed ${totalSuccessfulInstalls} of ${extensionsData.length} extensions successfully.`;
          } else {
            message = `Successfully installed all ${extensionsData.length} extensions with some warnings.`;
          }
          enqueueSnackbar(message, {
            variant: "warning",
            preventDuplicate: true,
          });

          // Show warning/error message with better context
          const issueMessages: string[] = [];
          if (cacheFailures > 0) {
            issueMessages.push(
              `${cacheFailures} extension${cacheFailures > 1 ? "s" : ""} not saved to local cache`,
            );
          }

          if (remoteFailures > 0 && cacheFailures === 0) {
            // Extensions were saved locally but not synced
            issueMessages.push(
              `${remoteFailures} extension${remoteFailures > 1 ? "s" : ""} saved locally but not synced to server (offline)`,
            );
          } else if (remoteFailures > 0) {
            issueMessages.push(
              `${remoteFailures} extension${remoteFailures > 1 ? "s" : ""} not synced to server`,
            );
          }

          if (failedExtensions.length > 0) {
            issueMessages.push(
              `${failedExtensions.length} extension${failedExtensions.length > 1 ? "s" : ""} failed completely`,
            );
          }

          if (issueMessages.length > 0) {
            const isOfflineScenario =
              remoteFailures > 0 && cacheFailures === 0 && failedExtensions.length === 0;
            const variant =
              failedExtensions.length > 0 ? "error" : isOfflineScenario ? "info" : "warning";
            const prefix = isOfflineScenario ? "Note: " : "Issues: ";

            enqueueSnackbar(`${prefix}${issueMessages.join(", ")}.`, {
              variant,
              preventDuplicate: true,
              persist: true,
            });
          }
        } else {
          // All failed - but we need to distinguish between cache and server failures
          const hasLocalInstallations = cacheFailures < extensionsData.length;
          const hasServerInstallations = remoteFailures < extensionsData.length;

          if (hasLocalInstallations && !hasServerInstallations) {
            // Successfully installed locally but not on server (offline scenario)
            enqueueSnackbar(
              `Installed ${extensionsData.length} extension${extensionsData.length > 1 ? "s" : ""} locally.`,
              {
                variant: "warning",
                preventDuplicate: true,
              },
            );

            enqueueSnackbar(
              `Unable to sync to server - extensions will be available locally but may not be accessible on other devices.`,
              {
                variant: "info",
                preventDuplicate: true,
                persist: true,
              },
            );
          } else {
            // Complete failure
            enqueueSnackbar(`Failed to install all ${extensionsData.length} extensions.`, {
              variant: "error",
              preventDuplicate: true,
            });

            // Show consolidated failure details
            const failureMessages: string[] = [];
            if (cacheFailures > 0) {
              failureMessages.push(`${cacheFailures} could not be saved to cache`);
            }
            if (remoteFailures > 0) {
              failureMessages.push(`${remoteFailures} could not be synced to server`);
            }

            if (failureMessages.length > 0) {
              enqueueSnackbar(`Details: ${failureMessages.join(", ")}.`, {
                variant: "error",
                preventDuplicate: true,
                persist: true,
              });
            }
          }
        }
      } catch (error: unknown) {
        setInstallingProgress((prev) => ({
          ...prev,
          inProgress: false,
        }));

        enqueueSnackbar(
          `An error occurred during extension installation: ${error instanceof Error ? error.message : "Unknown error"}`,
          { variant: "error" },
        );
      } finally {
        if (isPlayingInitialState) {
          play?.();
        }
        resetInstallingProgress();
      }
    },
    [
      startInstallingProgress,
      isPlaying,
      setInstallingProgress,
      enqueueSnackbar,
      installExtensions,
      resetInstallingProgress,
      play,
      formatFailures,
    ],
  );

  return { installFoxeExtensions };
}
