// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Layer } from "@fluentui/react";
import { useSnackbar } from "notistack";
import { extname } from "path";
import { useCallback, useLayoutEffect, useState } from "react";

type Props = {
  children: React.ReactNode; // Shown when dragging in a file.
  allowedExtensions?: string[];
  onDrop?: (event: { files?: File[]; handles?: FileSystemFileHandle[] }) => void;
};

export default function DocumentDropListener(props: Props): JSX.Element {
  const [hovering, setHovering] = useState(false);

  const { onDrop: onDropProp, allowedExtensions } = props;

  const { enqueueSnackbar } = useSnackbar();

  const onDrop = useCallback(
    async (ev: DragEvent) => {
      setHovering(false);

      if (!ev.dataTransfer || !allowedExtensions) {
        return;
      }

      let handles: FileSystemFileHandle[] | undefined = [];
      const handlePromises: Promise<FileSystemHandle | ReactNull>[] = [];
      const allFiles: File[] = [];
      const directories: FileSystemDirectoryEntry[] = [];
      const dataItems = ev.dataTransfer.items;
      for (const item of Array.from(dataItems)) {
        const entry = item.webkitGetAsEntry();

        // Attempt to grab the filesystem handle if the feature is available.
        // A file system handle is more versatile than File instances.
        // Note: awaiting on the fileSystemHandle function triggered a (bug?) where all other
        // dataTransfer items were ignored
        if ("getAsFileSystemHandle" in item) {
          handlePromises.push(item.getAsFileSystemHandle());
        }

        // Keep track of all File and Directory instaces
        if (entry?.isFile === true) {
          const file = item.getAsFile();
          if (file) {
            allFiles.push(file);
          }
        } else if (entry?.isDirectory === true) {
          directories.push(entry as FileSystemDirectoryEntry);
        }
      }

      // If we had any directories, then we will not use handles and instead use File instances.
      // A future enhancement could be to load handles from directories.
      if (directories.length === 0) {
        for (const promise of handlePromises) {
          const fileSystemHandle = await promise;
          if (fileSystemHandle instanceof FileSystemFileHandle) {
            handles.push(fileSystemHandle);
          }
        }
      }

      // Allow event to bubble for non-file based drag and drop
      if (allFiles.length === 0 && directories.length === 0 && handles.length === 0) {
        return;
      }

      for (const directory of directories) {
        // Read the list of files and folders in this directory (non-recursively)
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          directory.createReader().readEntries(resolve, reject);
        });

        // Add all files in this directory to our list of files
        for (const entry of entries) {
          if (entry.isFile) {
            const file = await new Promise<File>((resolve, reject) => {
              (entry as FileSystemFileEntry).file(resolve, reject);
            });
            allFiles.push(file);
          }
        }
      }

      // If we had any directories, then we will not use handles and instead use File instances.
      // A future enhancement could be to load handles from directories.
      if (directories.length > 0 || handles.length === 0) {
        handles = undefined;
      }

      const filteredFiles = allFiles.filter((file) =>
        allowedExtensions.includes(extname(file.name)),
      );
      const filteredHandles = handles?.filter((handle) =>
        allowedExtensions.includes(extname(handle.name)),
      );

      // Check for no supported files
      if (filteredFiles.length === 0 && filteredHandles?.length === 0) {
        enqueueSnackbar("The file format is unsupported.", { variant: "error" });
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();

      onDropProp?.({ files: filteredFiles, handles: filteredHandles });
    },
    [enqueueSnackbar, onDropProp, allowedExtensions],
  );

  const onDragOver = useCallback(
    (ev: DragEvent) => {
      if (!allowedExtensions) {
        return;
      }

      const { dataTransfer } = ev;
      if (dataTransfer?.types.includes("Files") === true) {
        ev.stopPropagation();
        ev.preventDefault();
        dataTransfer.dropEffect = "copy";
        setHovering(true);
      }
    },
    [allowedExtensions],
  );

  const onDragLeave = useCallback(() => {
    setHovering(false);
  }, []);

  useLayoutEffect(() => {
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragleave", onDragLeave);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragleave", onDragLeave);
    };
  }, [onDragLeave, onDragOver, onDrop]);

  return (
    <>
      <input // Expose a hidden input for Puppeteer to use to drop a file in.
        type="file"
        style={{ display: "none" }}
        onChange={(event) => {
          if (event.target.files) {
            props.onDrop?.({ files: Array.from(event.target.files) });
          }
        }}
        data-puppeteer-file-upload
        multiple
      />
      {hovering && <Layer>{props.children}</Layer>}
    </>
  );
}
