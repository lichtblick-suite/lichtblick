// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { nanoid } from "nanoid";
import { SnackbarKey, useSnackbar } from "notistack";
import { extname } from "path";
import { useCallback, useEffect, useRef } from "react";

import Logger from "@lichtblick/log";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import {
  DataSourceArgs,
  IDataSourceFactory,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";

import { useInstallingExtensionsStore } from "./useInstallingExtensionsStore";

type UseInstallingExtensionsState = {
  handleFiles: (files: File[]) => Promise<void>;
};

type UseInstallingExtensionsStateProps = {
  availableSources: readonly IDataSourceFactory[];
  selectSource: (sourceId: string, args?: DataSourceArgs) => void;
  isPlaying: boolean;
  playerEvents: {
    play: (() => void) | undefined;
    pause: (() => void) | undefined;
  };
};

const log = Logger.getLogger(__filename);

export function useInstallingExtensionsState({
  availableSources,
  selectSource,
  isPlaying,
  playerEvents: { play, pause },
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
    async (extensionsData: Uint8Array[]) => {
      startInstallingProgress(extensionsData.length);

      const isPlayingInitialState = isPlaying;

      try {
        for (let i = 0; i < extensionsData.length; i += INSTALL_EXTENSIONS_BATCH) {
          const chunk = extensionsData.slice(i, i + INSTALL_EXTENSIONS_BATCH);
          const result = await installExtensions("local", chunk);

          const installedCount = result.filter(({ success }) => success).length;
          setInstallingProgress((prev) => ({
            ...prev,
            installed: prev.installed + installedCount,
          }));
        }

        setInstallingProgress((prev) => ({
          ...prev,
          inProgress: false,
        }));

        enqueueSnackbar(`Successfully installed all ${extensionsData.length} extensions.`, {
          variant: "success",
          preventDuplicate: true,
          autoHideDuration: 3500,
        });
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
    ],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      pause?.();

      const extensionsData: Uint8Array[] = [];
      const otherFiles: File[] = [];

      for (const file of files) {
        try {
          if (file.name.endsWith(".foxe")) {
            const buffer = await file.arrayBuffer();
            extensionsData.push(new Uint8Array(buffer));
          } else {
            otherFiles.push(file);
          }
        } catch (error) {
          log.error(`Error reading file ${file.name}`, error);
        }
      }

      if (extensionsData.length > 0) {
        await installFoxeExtensions(extensionsData);
      }

      if (otherFiles.length > 0) {
        const source = availableSources.find((s) =>
          otherFiles.some((file) => s.supportedFileTypes?.includes(extname(file.name)) ?? false),
        );

        if (source) {
          selectSource(source.id, { type: "file", files: otherFiles });
        }
      }
    },
    [availableSources, installFoxeExtensions, pause, selectSource],
  );

  return { handleFiles };
}
