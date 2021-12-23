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
import { extname } from "path";
import { useCallback, useLayoutEffect, useState } from "react";
import { useToasts } from "react-toast-notifications";

type Props = {
  children: React.ReactNode; // Shown when dragging in a file.
  allowedExtensions?: string[];
  filesSelected?: (arg: { files: File[]; shiftPressed: boolean }) => void;
};

export default function DocumentDropListener(props: Props): JSX.Element {
  const [hovering, setHovering] = useState(false);

  const { filesSelected, allowedExtensions } = props;

  const { addToast } = useToasts();

  const onDrop = useCallback(
    async (ev: DragEvent) => {
      setHovering(false);

      if (!ev.dataTransfer) {
        return;
      }

      const allFiles: File[] = [];
      const directories: FileSystemDirectoryEntry[] = [];
      for (const item of ev.dataTransfer.items) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isFile) {
            const file = item.getAsFile();
            if (file) {
              allFiles.push(file);
            }
          } else if (entry.isDirectory) {
            directories.push(entry as FileSystemDirectoryEntry);
          }
        }
      }

      // Allow event to bubble for non-file based drag and drop
      if ((allFiles.length === 0 && directories.length === 0) || !allowedExtensions) {
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

      // Organize files by (supported) extension
      const filesByType = new Map<string, File[]>();
      for (const file of allFiles) {
        const fileExtension = extname(file.name);
        if (allowedExtensions.includes(fileExtension)) {
          const filesOfType = filesByType.get(fileExtension) ?? [];
          filesOfType.push(file);
          filesByType.set(fileExtension, filesOfType);
        }
      }

      // Check for no supported files
      if (filesByType.size === 0) {
        addToast("The file format is unsupported.", {
          appearance: "error",
        });
        return;
      }

      // Check for more than one supported file type
      if (filesByType.size > 1) {
        addToast("Cannot open different file types at once.", {
          appearance: "error",
        });
        return;
      }

      const files: File[] = filesByType.values().next().value;

      ev.preventDefault();
      ev.stopPropagation();
      filesSelected?.({ files, shiftPressed: ev.shiftKey });
    },
    [addToast, filesSelected, allowedExtensions],
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
            props.filesSelected?.({ files: Array.from(event.target.files), shiftPressed: false });
          }
        }}
        data-puppeteer-file-upload
        multiple
      />
      {hovering && <Layer>{props.children}</Layer>}
    </>
  );
}
