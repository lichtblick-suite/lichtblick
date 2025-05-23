// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { nanoid } from "nanoid";
import { SnackbarKey, useSnackbar } from "notistack";
import { useCallback, useEffect, useRef } from "react";

import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";

import { useInstallingExtensionsStore } from "./useInstallingExtensionsStore";

type UseInstallingExtensionsState = {
  installFoxeExtensions: (extensionsData: Uint8Array[]) => Promise<void>;
};

type UseInstallingExtensionsStateProps = {
  isPlaying: boolean;
  playerEvents: {
    play: (() => void) | undefined;
  };
};

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

  return { installFoxeExtensions };
}
