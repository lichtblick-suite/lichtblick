// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import path from "path";
import { useCallback, useMemo } from "react";

import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import showOpenFilePicker from "@foxglove/studio-base/util/showOpenFilePicker";

export function useOpenFile(sources: IDataSourceFactory[]): () => Promise<void> {
  const { selectSource } = usePlayerSelection();

  const allExtensions = useMemo(() => {
    return sources.reduce((all, source) => {
      if (!source.supportedFileTypes) {
        return all;
      }

      return [...all, ...source.supportedFileTypes];
    }, [] as string[]);
  }, [sources]);

  return useCallback(async () => {
    const [fileHandle] = await showOpenFilePicker({
      types: [
        {
          description: allExtensions.join(", "),
          accept: { "application/octet-stream": allExtensions },
        },
      ],
    });
    if (!fileHandle) {
      return;
    }

    const file = await fileHandle.getFile();
    const foundSource = sources.find((source) => {
      if (!source.supportedFileTypes) {
        return false;
      }

      const extension = path.extname(file.name);
      return source.supportedFileTypes.includes(extension);
    });
    if (!foundSource) {
      throw new Error(`Cannot find source to handle ${file.name}`);
    }

    selectSource(foundSource.id, { type: "file", files: [file] });
  }, [allExtensions, selectSource, sources]);
}
