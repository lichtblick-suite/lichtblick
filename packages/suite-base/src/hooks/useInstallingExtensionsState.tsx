// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { nanoid } from "nanoid";
import { SnackbarKey, useSnackbar } from "notistack";
import { extname } from "path";
import { useCallback, useEffect, useRef } from "react";

import Logger from "@lichtblick/log";
import InstallingSnackbar from "@lichtblick/suite-base/InstallingSnackbar";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import {
  DataSourceArgs,
  IDataSourceFactory,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";

import { useInstallingExtensionsStore } from "./useInstallingExtensionsStore";

type UseInstallingExtensionsState = {
  handleFiles: (files: File[]) => Promise<void>;
};

const log = Logger.getLogger(__filename);

export function useInstallingExtensionsState(
  availableSources: readonly IDataSourceFactory[],
  selectSource: (sourceId: string, args?: DataSourceArgs) => void,
  play: (() => void) | undefined,
  pause: (() => void) | undefined,
): UseInstallingExtensionsState {
  const installExtensions = useExtensionCatalog((state) => state.installExtensions);
  const INSTALL_EXTENSIONS_BATCH = 1;

  const setInstallingProgress = useInstallingExtensionsStore((s) => s.setInstallingProgress);
  const installingProgress = useInstallingExtensionsStore((s) => s.installingProgress);

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const progressSnackbarKeyRef = useRef<SnackbarKey>(`installing-extensions-${nanoid()}`);
  const progressSnackbarKey = progressSnackbarKeyRef.current;

  useEffect(() => {
    const { installed, total } = installingProgress;
    // eslint-disable-next-line no-restricted-syntax
    console.log("GOLD installedCount/total", installed, total);

    if (total === 0 || installed === total) {
      closeSnackbar(progressSnackbarKey);
      return;
    }

    enqueueSnackbar(<InstallingSnackbar installed={installed} total={total} />, {
      key: progressSnackbarKey,
      variant: "info",
      preventDuplicate: true,
      persist: true,
    });
  }, [closeSnackbar, enqueueSnackbar, installingProgress, progressSnackbarKey]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      if (pause) {
        pause();
      }

      const otherFiles: File[] = [];
      log.debug("open files", files);

      const extensionsData: Uint8Array[] = [];
      for (const file of files) {
        try {
          if (file.name.endsWith(".foxe")) {
            const arrayBuffer = await file.arrayBuffer();
            extensionsData.push(new Uint8Array(arrayBuffer));
          } else {
            otherFiles.push(file);
          }
        } catch (error) {
          console.error(`Error loading foxe file ${file.name}`, error);
        }
      }

      if (extensionsData.length > 0) {
        try {
          const total = extensionsData.length;

          setInstallingProgress({
            installed: 0,
            total: extensionsData.length,
            inProgress: true,
          });

          for (let i = 0; i < extensionsData.length; i += INSTALL_EXTENSIONS_BATCH) {
            const chunk = extensionsData.slice(i, i + INSTALL_EXTENSIONS_BATCH);

            const result = await installExtensions("local", chunk);
            const installed = result.filter(({ success }) => success);
            setInstallingProgress((lastState) => ({
              ...lastState,
              installed: lastState.installed + installed.length,
            }));
          }

          if (installingProgress.installed === installingProgress.total) {
            console.log("installingProgress.inProgress BEFORE", installingProgress.inProgress);
            if (play) {
              play();
            }
            setInstallingProgress((prevState) => ({
              ...prevState,
              installingInProgress: false,
            }));
            console.log("installingProgress.inProgress AFTER", installingProgress.inProgress);
            enqueueSnackbar(`Successfully installed all ${total} extensions.`, {
              variant: "success",
            });
          }
        } catch (error) {
          if (play) {
            play();
          }
          setInstallingProgress((prevState) => ({
            ...prevState,
            installingInProgress: false,
          }));
          enqueueSnackbar(`An error occurred during extension installation: ${error.message}`, {
            variant: "error",
          });
        }
      }

      if (otherFiles.length > 0) {
        // Look for a source that supports the dragged file extensions
        for (const source of availableSources) {
          const filteredFiles = otherFiles.filter((file): boolean => {
            const ext = extname(file.name);
            return source.supportedFileTypes ? source.supportedFileTypes.includes(ext) : false;
          });

          // select the first source that has files that match the supported extensions
          if (filteredFiles.length > 0) {
            selectSource(source.id, { type: "file", files: otherFiles });
            break;
          }
        }
      }
    },
    [
      setInstallingProgress,
      pause,
      installingProgress.installed,
      installingProgress.total,
      installingProgress.inProgress,
      installExtensions,
      play,
      enqueueSnackbar,
      availableSources,
      selectSource,
    ],
  );

  return { handleFiles };
}
