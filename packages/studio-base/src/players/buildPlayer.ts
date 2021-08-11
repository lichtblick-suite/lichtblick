// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import { Player, PlayerMetricsCollectorInterface } from "@foxglove/studio-base/players/types";
import { CoreDataProviders } from "@foxglove/studio-base/randomAccessDataProviders/constants";
import { RandomAccessDataProviderDescriptor } from "@foxglove/studio-base/randomAccessDataProviders/types";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

export type BuildPlayerOptions = {
  unlimitedMemoryCache: boolean;
  metricsCollector: PlayerMetricsCollectorInterface;
};

export function buildPlayerFromDescriptor(
  childDescriptor: RandomAccessDataProviderDescriptor,
  options: BuildPlayerOptions,
): Player {
  const rootDescriptor = {
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
