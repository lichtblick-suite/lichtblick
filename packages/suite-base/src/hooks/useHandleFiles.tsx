// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { extname } from "path";
import { useCallback } from "react";

import Logger from "@lichtblick/log";
import {
  DataSourceArgs,
  IDataSourceFactory,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useInstallingExtensionsState } from "@lichtblick/suite-base/hooks/useInstallingExtensionsState";

type UseHandleFiles = {
  handleFiles: (files: File[]) => Promise<void>;
};

type UseHandleFilesProps = {
  availableSources: readonly IDataSourceFactory[];
  selectSource: (sourceId: string, args?: DataSourceArgs) => void;
  isPlaying: boolean;
  playerEvents: {
    play: (() => void) | undefined;
    pause: (() => void) | undefined;
  };
};

const log = Logger.getLogger(__filename);

export function useHandleFiles({
  availableSources,
  selectSource,
  isPlaying,
  playerEvents: { play, pause },
}: UseHandleFilesProps): UseHandleFiles {
  const { installFoxeExtensions } = useInstallingExtensionsState({
    isPlaying,
    playerEvents: { play },
  });

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

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
        pause?.();
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
