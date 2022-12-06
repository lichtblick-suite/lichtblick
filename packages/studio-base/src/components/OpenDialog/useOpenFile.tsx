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
    // Find the first _file_ source which can load our extension
    const matchingSources = sources.filter((source) => {
      // Only consider _file_ type sources that have a list of supported file types
      if (!source.supportedFileTypes || source.type !== "file") {
        return false;
      }

      const extension = path.extname(file.name);
      return source.supportedFileTypes.includes(extension);
    });

    if (matchingSources.length > 1) {
      throw new Error(`Multiple source matched ${file.name}. This is not supported.`);
    }

    const foundSource = matchingSources[0];
    if (!foundSource) {
      throw new Error(`Cannot find source to handle ${file.name}`);
    }

    selectSource(foundSource.id, { type: "file", handle: fileHandle });
  }, [allExtensions, selectSource, sources]);
}
