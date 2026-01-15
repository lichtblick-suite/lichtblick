// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { useSnackbar } from "notistack";
import { extname } from "path";
import { useCallback, useLayoutEffect, useState } from "react";

import Logger from "@lichtblick/log";
import DropOverlay from "@lichtblick/suite-base/components/DropOverlay";
import { NamespaceSelectionModal } from "@lichtblick/suite-base/components/NamespaceSelectionModal";
import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import { APP_CONFIG } from "@lichtblick/suite-base/constants/config";
import { Namespace } from "@lichtblick/suite-base/types";

const log = Logger.getLogger(__filename);

type DocumentDropListenerProps = {
  allowedExtensions?: string[];
  onDrop?: (event: {
    files?: File[];
    handles?: FileSystemFileHandle[]; // foxglove-depcheck-used: @types/wicg-file-system-access
    namespace?: Namespace;
  }) => void;
};

type PendingFile = {
  files: File[];
  handles?: FileSystemFileHandle[];
};

export default function DocumentDropListener(props: DocumentDropListenerProps): React.JSX.Element {
  const [hovering, setHovering] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile | undefined>(undefined);
  const [showNamespaceModal, setShowNamespaceModal] = useState(false);

  const { onDrop: onDropProp, allowedExtensions } = props;

  const { enqueueSnackbar } = useSnackbar();

  const shouldShowNamespaceModal = useCallback((files: File[]): boolean => {
    const url = new URL(window.location.href);
    const workspace = url.searchParams.get("workspace");
    if (!workspace || !APP_CONFIG.apiUrl) {
      return false;
    }

    const hasLayoutOrExtension = files.some(
      (file) =>
        file.name.endsWith(AllowedFileExtensions.JSON) ||
        file.name.endsWith(AllowedFileExtensions.FOXE),
    );

    return hasLayoutOrExtension;
  }, []);

  const handleNamespaceSelection = useCallback(
    (namespace: Namespace) => {
      if (pendingFiles) {
        onDropProp?.({
          files: pendingFiles.files,
          handles: pendingFiles.handles,
          namespace,
        });
        setPendingFiles(undefined);
      }
      setShowNamespaceModal(false);
    },
    [onDropProp, pendingFiles],
  );

  const handleModalClose = useCallback(() => {
    setShowNamespaceModal(false);
    setPendingFiles(undefined);
  }, []);

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
        // Attempt to grab the filesystem handle if the feature is available.
        // A file system handle is more versatile than File instances.
        // Note: awaiting on the fileSystemHandle function triggered a (bug?) where all other
        // dataTransfer items were ignored
        //
        // getAsFileSystemHandle is only available in a secure context. If called outside a secure
        // context the observed behavior is a browser (tab) crash. To avoid the crash we check that
        // we are in a secure context and only call the api if available.
        //
        // Handles power features like recents which require saving handles in indexeddb. This check
        // allows us to gracefully degrade away from this feature if the user deploys Studio in an
        // unsecure context.
        if (window.isSecureContext && "getAsFileSystemHandle" in item) {
          handlePromises.push(item.getAsFileSystemHandle());
        } else {
          log.info(
            "getAsFileSystemHandle not available on a dropped item. Features requiring handles will not be available for the item",
            item,
          );
        }

        const entry = item.webkitGetAsEntry();

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
        enqueueSnackbar("The file format is not supported.", { variant: "error" });
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();

      if (shouldShowNamespaceModal(filteredFiles)) {
        setPendingFiles({ files: filteredFiles, handles: filteredHandles });
        setShowNamespaceModal(true);
      } else {
        onDropProp?.({ files: filteredFiles, handles: filteredHandles, namespace: "local" });
      }
    },
    [enqueueSnackbar, onDropProp, allowedExtensions, shouldShowNamespaceModal],
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
            const files = Array.from(event.target.files);
            if (shouldShowNamespaceModal(files)) {
              setPendingFiles({ files });
              setShowNamespaceModal(true);
            } else {
              props.onDrop?.({ files, namespace: "local" });
            }
          }
        }}
        data-puppeteer-file-upload
        multiple
      />
      <DropOverlay open={hovering}>Drop a file here</DropOverlay>
      {pendingFiles && (
        <NamespaceSelectionModal
          open={showNamespaceModal}
          onClose={handleModalClose}
          onSelect={handleNamespaceSelection}
          files={pendingFiles.files}
        />
      )}
    </>
  );
}
