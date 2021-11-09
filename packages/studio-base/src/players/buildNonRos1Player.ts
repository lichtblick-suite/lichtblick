// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import { BuildPlayerOptions } from "@foxglove/studio-base/players/buildPlayer";
import { Player } from "@foxglove/studio-base/players/types";
import { CoreDataProviders } from "@foxglove/studio-base/randomAccessDataProviders/constants";
import { RandomAccessDataProviderDescriptor } from "@foxglove/studio-base/randomAccessDataProviders/types";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

// This is separate from buildPlayerFromDescriptor because we can't use ParseMessages
// with non-ROS1 DataProviders
export function buildNonRos1PlayerFromDescriptor(
  name: string,
  childDescriptor: RandomAccessDataProviderDescriptor,
  options: BuildPlayerOptions,
): Player {
  const rootDescriptor: RandomAccessDataProviderDescriptor = {
    label: name,
    filePath: childDescriptor.filePath,
    name: CoreDataProviders.MemoryCacheDataProvider,
    args: { unlimitedCache: options.unlimitedMemoryCache },
    children: [childDescriptor],
  };

  return new RandomAccessPlayer(rootDescriptor, {
    metricsCollector: options.metricsCollector,
    seekToTime: getSeekToTime(),
  });
}
