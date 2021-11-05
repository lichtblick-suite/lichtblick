// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import { Player, PlayerMetricsCollectorInterface } from "@foxglove/studio-base/players/types";
import { CoreDataProviders } from "@foxglove/studio-base/randomAccessDataProviders/constants";
import {
  getLocalBagDescriptor,
  getRemoteBagDescriptor,
} from "@foxglove/studio-base/randomAccessDataProviders/standardDataProviderDescriptors";
import { RandomAccessDataProviderDescriptor } from "@foxglove/studio-base/randomAccessDataProviders/types";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

export type BuildPlayerOptions = {
  unlimitedMemoryCache: boolean;
  metricsCollector: PlayerMetricsCollectorInterface;
};

export function buildPlayerFromDescriptor(
  name: string,
  childDescriptor: RandomAccessDataProviderDescriptor,
  options: BuildPlayerOptions,
): Player {
  const rootDescriptor: RandomAccessDataProviderDescriptor = {
    label: name,
    filePath: childDescriptor.filePath,
    name: CoreDataProviders.ParseMessagesDataProvider,
    args: {},
    children: [
      {
        name: CoreDataProviders.MemoryCacheDataProvider,
        args: { unlimitedCache: options.unlimitedMemoryCache },
        children: [childDescriptor],
      },
    ],
  };

  return new RandomAccessPlayer(rootDescriptor, {
    metricsCollector: options.metricsCollector,
    seekToTime: getSeekToTime(),
  });
}

export function buildPlayerFromFiles(files: File[], options: BuildPlayerOptions): Player {
  const name = files.map((file) => String(file.name)).join(", ");
  if (files.length === 1) {
    return buildPlayerFromDescriptor(name, getLocalBagDescriptor(files[0] as File), options);
  }
  throw new Error(`Unsupported number of files: ${files.length}`);
}

export function buildPlayerFromBagURLs(urls: string[], options: BuildPlayerOptions): Player {
  const name = urls.map((url) => url.toString()).join(", ");

  if (urls.length === 1) {
    return buildPlayerFromDescriptor(
      name,
      getRemoteBagDescriptor(urls[0] as string, options),
      options,
    );
  }

  throw new Error(`Unsupported number of urls: ${urls.length}`);
}
