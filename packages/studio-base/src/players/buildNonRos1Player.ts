// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import { BuildPlayerOptions } from "@foxglove/studio-base/players/buildPlayer";
import { Player } from "@foxglove/studio-base/players/types";
import { RandomAccessDataProviderDescriptor } from "@foxglove/studio-base/randomAccessDataProviders/types";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

// This is separate from buildPlayerFromDescriptor because we can't use ParseMessages and
// MemoryCache with non-ROS1 DataProviders currently (they only support ROS1 binary messages)
export function buildNonRos1PlayerFromDescriptor(
  rootDescriptor: RandomAccessDataProviderDescriptor,
  options: BuildPlayerOptions,
): Player {
  return new RandomAccessPlayer(rootDescriptor, {
    metricsCollector: options.metricsCollector,
    seekToTime: getSeekToTime(),
  });
}
