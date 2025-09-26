// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { extname } from "path";

import Logger from "@lichtblick/log";
import { HandleDropProps } from "@lichtblick/suite-base/components/MultiDropZoneListener/types";
import { Namespace } from "@lichtblick/suite-base/types";

const log = Logger.getLogger(__filename);

export default async function handleDrop({
  allowedExtensions,
  dropZone,
  enqueueSnackbar,
  event,
  onDrop,
  setActiveZone,
  setHovering,
}: HandleDropProps): Promise<void> {
  setHovering(undefined);
  setActiveZone(undefined);

  if (!event.dataTransfer || !allowedExtensions) {
    return;
  }

  let handles: FileSystemFileHandle[] | undefined = [];
  const handlePromises: Promise<FileSystemHandle | ReactNull>[] = [];
  const allFiles: File[] = [];
  const directories: FileSystemDirectoryEntry[] = [];
  const dataItems = event.dataTransfer.items;

  for (const item of Array.from(dataItems)) {
    if (window.isSecureContext && "getAsFileSystemHandle" in item) {
      handlePromises.push(item.getAsFileSystemHandle());
    } else {
      log.info(
        "getAsFileSystemHandle not available on a dropped item. Features requiring handles will not be available for the item",
        item,
      );
    }

    const entry = item.webkitGetAsEntry();

    if (entry?.isFile === true) {
      const file = item.getAsFile();
      if (file) {
        allFiles.push(file);
      }
    } else if (entry?.isDirectory === true) {
      directories.push(entry as FileSystemDirectoryEntry);
    }
  }

  if (directories.length === 0) {
    for (const promise of handlePromises) {
      const fileSystemHandle = await promise;
      if (fileSystemHandle instanceof FileSystemFileHandle) {
        handles.push(fileSystemHandle);
      }
    }
  }

  if (allFiles.length === 0 && directories.length === 0 && handles.length === 0) {
    return;
  }

  for (const directory of directories) {
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      directory.createReader().readEntries(resolve, reject);
    });

    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          (entry as FileSystemFileEntry).file(resolve, reject);
        });
        allFiles.push(file);
      }
    }
  }

  if (directories.length > 0 || handles.length === 0) {
    handles = undefined;
  }

  const filteredFiles = allFiles.filter((file) => allowedExtensions.includes(extname(file.name)));
  const filteredHandles = handles?.filter((handle) =>
    allowedExtensions.includes(extname(handle.name)),
  );

  if (filteredFiles.length === 0 && filteredHandles?.length === 0) {
    enqueueSnackbar("The file format is not supported.", { variant: "error" });
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  let namespace: Namespace | undefined;
  let isSource = false;

  if (dropZone === "source") {
    isSource = true;
  } else {
    namespace = dropZone;
  }

  onDrop?.({ files: filteredFiles, handles: filteredHandles, namespace, isSource });
}
