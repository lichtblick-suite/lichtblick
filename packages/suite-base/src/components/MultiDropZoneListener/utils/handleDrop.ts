// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { extname } from "path";

import Logger from "@lichtblick/log";
import { HandleDropProps } from "@lichtblick/suite-base/components/MultiDropZoneListener/types";
import { Namespace } from "@lichtblick/suite-base/types";

const log = Logger.getLogger(__filename);

interface ProcessedItems {
  files: File[];
  directories: FileSystemDirectoryEntry[];
  handlePromises: Promise<FileSystemHandle | ReactNull>[];
}

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

  const {
    files: initialFiles,
    directories,
    handlePromises,
  } = await processDataItems(event.dataTransfer.items);

  const directoryFiles = await processDirectories(directories);
  const allFiles = [...initialFiles, ...directoryFiles];
  const handles = await resolveFileSystemHandles(handlePromises, {
    hasDirectories: directories.length > 0,
  });

  if (allFiles.length === 0 && directories.length === 0 && (handles?.length ?? 0) === 0) {
    return;
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

  const isSource: boolean = dropZone === "source";
  const namespace: Namespace | undefined = isSource ? undefined : (dropZone as Namespace);

  onDrop?.({
    files: filteredFiles,
    handles: filteredHandles,
    namespace,
    isSource,
  });
}

async function processDataItems(dataItems: DataTransferItemList): Promise<ProcessedItems> {
  const files: File[] = [];
  const directories: FileSystemDirectoryEntry[] = [];
  const handlePromises: Promise<FileSystemHandle | ReactNull>[] = [];

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
        files.push(file);
      }
    } else if (entry?.isDirectory === true) {
      directories.push(entry as FileSystemDirectoryEntry);
    }
  }

  return { files, directories, handlePromises };
}

async function resolveFileSystemHandles(
  handlePromises: Promise<FileSystemHandle | ReactNull>[],
  options: { hasDirectories: boolean },
): Promise<FileSystemFileHandle[] | undefined> {
  if (options.hasDirectories) {
    return undefined;
  }

  const handles: FileSystemFileHandle[] = [];
  for (const promise of handlePromises) {
    const fileSystemHandle = await promise;
    if (fileSystemHandle instanceof FileSystemFileHandle) {
      handles.push(fileSystemHandle);
    }
  }

  return handles.length === 0 ? undefined : handles;
}

async function processDirectories(directories: FileSystemDirectoryEntry[]): Promise<File[]> {
  const entryToFile = async (entry: FileSystemEntry): Promise<File | undefined> =>
    await new Promise((resolve, reject) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file(resolve, reject);
      } else {
        resolve(undefined);
      }
    });

  const readDirectory = async (directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> =>
    await new Promise((resolve, reject) => {
      directory.createReader().readEntries(resolve, reject);
    });

  const filesArrays: File[][] = await Promise.all(
    directories.map(async (directory) => {
      const entries = await readDirectory(directory);
      const files = await Promise.all(entries.map(entryToFile));
      return files.filter((file) => file != undefined) as File[];
    }),
  );

  return filesArrays.flat();
}
