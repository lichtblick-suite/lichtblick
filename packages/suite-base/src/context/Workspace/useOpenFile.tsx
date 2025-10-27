// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { enqueueSnackbar } from "notistack";
import path from "path";
import { useCallback, useMemo } from "react";

import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { FILE_ACCEPT_TYPE } from "@lichtblick/suite-base/context/Workspace/constants";
import { normalizeExtensions } from "@lichtblick/suite-base/context/Workspace/utils";
import showOpenFilePicker from "@lichtblick/suite-base/util/showOpenFilePicker";

export function useOpenFile(sources: readonly IDataSourceFactory[]): () => Promise<void> {
  const { selectSource } = usePlayerSelection();

  const throwErrorAndSnackbar = (message: string): void => {
    enqueueSnackbar(message, { variant: "error" });
    throw new Error(message);
  };

  const allExtensions = useMemo(() => {
    return sources.reduce<string[]>((all, source) => {
      if (!source.supportedFileTypes) {
        return all;
      }

      return [...all, ...source.supportedFileTypes];
    }, []);
  }, [sources]);

  const normalizeExtensionsArray = useMemo(
    () => normalizeExtensions(allExtensions),
    [allExtensions],
  );

  return useCallback(async () => {
    const filesHandle = await showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: normalizeExtensionsArray.join(", "),
          accept: {
            [FILE_ACCEPT_TYPE]: normalizeExtensionsArray,
          },
        },
      ],
    });
    if (filesHandle.length === 0) {
      return;
    }

    const processedFiles = await Promise.all(
      filesHandle.map(async (handle) => {
        const file = await handle.getFile();
        return {
          file,
          extension: path.extname(file.name),
        };
      }),
    );

    const uniqueExtensions = new Set(processedFiles.map(({ extension }) => extension));
    if (uniqueExtensions.size > 1) {
      throwErrorAndSnackbar(
        `Multiple file extensions detected: ${[...uniqueExtensions].join(
          ", ",
        )}. All files must have the same extension.`,
      );
    }

    const [extension] = uniqueExtensions;

    const matchingSources = sources.filter(
      (source) =>
        (source.supportedFileTypes &&
          source.type === "file" &&
          source.supportedFileTypes.includes(extension!)) ??
        false,
    );

    if (matchingSources.length === 0) {
      throwErrorAndSnackbar(`Cannot find a source to handle files with extension ${extension}`);
    }

    if (matchingSources.length > 1) {
      throwErrorAndSnackbar(
        `The file extension "${extension}" is not supported. Please select files with the following extensions: ${allExtensions.join(", ")}.`,
      );
    }

    /**
     * Should be removed when implement the rest of extensions.
     */
    if (extension !== ".mcap" && processedFiles.length > 1) {
      throwErrorAndSnackbar(`The application only support multiple files for MCAP extension.`);
    }
    selectSource(matchingSources[0]!.id, {
      type: "file",
      handles: filesHandle,
    });
  }, [allExtensions, normalizeExtensionsArray, selectSource, sources]);
}
