// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CoreDataProviders } from "@foxglove/studio-base/dataProviders/constants";
import { rootGetDataProvider } from "@foxglove/studio-base/dataProviders/rootGetDataProvider";
import { DataProviderDescriptor } from "@foxglove/studio-base/dataProviders/types";
import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import AutomatedRunPlayer from "@foxglove/studio-base/players/automatedRun/AutomatedRunPlayer";
import PerformanceMeasuringClient from "@foxglove/studio-base/players/automatedRun/performanceMeasuringClient";
import videoRecordingClient from "@foxglove/studio-base/players/automatedRun/videoRecordingClient";
import { Player, PlayerMetricsCollectorInterface } from "@foxglove/studio-base/players/types";
import {
  inVideoRecordingMode,
  inPlaybackPerformanceMeasuringMode,
} from "@foxglove/studio-base/util/inAutomatedRunMode";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

export type BuildPlayerOptions = {
  unlimitedMemoryCache: boolean;
  metricsCollector: PlayerMetricsCollectorInterface;
};

export function buildPlayerFromDescriptor(
  childDescriptor: DataProviderDescriptor,
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

  if (inVideoRecordingMode()) {
    return new AutomatedRunPlayer(rootGetDataProvider(rootDescriptor), videoRecordingClient);
  }

  if (inPlaybackPerformanceMeasuringMode()) {
    return new AutomatedRunPlayer(
      rootGetDataProvider(rootDescriptor),
      new PerformanceMeasuringClient(),
    );
  }

  return new RandomAccessPlayer(rootDescriptor, {
    metricsCollector: options.metricsCollector,
    seekToTime: getSeekToTime(),
  });
}
