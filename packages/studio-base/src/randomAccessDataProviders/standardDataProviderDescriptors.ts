// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { CoreDataProviders } from "@foxglove/studio-base/randomAccessDataProviders/constants";
import { RandomAccessDataProviderDescriptor } from "@foxglove/studio-base/randomAccessDataProviders/types";

function wrapInWorker(
  descriptor: RandomAccessDataProviderDescriptor,
): RandomAccessDataProviderDescriptor {
  return {
    label: descriptor.label,
    filePath: descriptor.filePath,
    name: CoreDataProviders.WorkerDataProvider,
    args: {},
    children: [descriptor],
  };
}

export function getLocalBagDescriptor(file: File): RandomAccessDataProviderDescriptor {
  return wrapInWorker({
    name: CoreDataProviders.BagDataProvider,
    filePath: (file as { path?: string }).path, // File.path is added by Electron
    args: { bagPath: { type: "file", file } },
    children: [],
  });
}

export function getRemoteBagDescriptor(
  url: string,
  options: { unlimitedMemoryCache: boolean },
): RandomAccessDataProviderDescriptor {
  const bagDataProvider = {
    name: CoreDataProviders.BagDataProvider,
    args: {
      bagPath: { type: "remoteBagUrl", url },
      cacheSizeInBytes: options.unlimitedMemoryCache ?? false ? Infinity : undefined,
    },
    children: [],
  };

  return wrapInWorker(bagDataProvider);
}

export function getLocalRosbag2Descriptor(
  folder: FileSystemDirectoryHandle,
): RandomAccessDataProviderDescriptor {
  return {
    label: folder.name,
    name: CoreDataProviders.Rosbag2DataProvider,
    args: { bagFolderPath: { type: "folder", folder } },
    children: [],
  };
}

export function getLocalUlogDescriptor(file: File): RandomAccessDataProviderDescriptor {
  return {
    label: file.name,
    name: CoreDataProviders.UlogDataProvider,
    filePath: (file as { path?: string }).path, // File.path is added by Electron
    args: { filePath: { type: "file", file } },
    children: [],
  };
}
