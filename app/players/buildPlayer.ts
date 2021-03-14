// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CoreDataProviders } from "@foxglove-studio/app/dataProviders/constants";
import { rootGetDataProvider } from "@foxglove-studio/app/dataProviders/rootGetDataProvider";
import { DataProviderDescriptor } from "@foxglove-studio/app/dataProviders/types";
import RandomAccessPlayer from "@foxglove-studio/app/players/RandomAccessPlayer";
import AutomatedRunPlayer from "@foxglove-studio/app/players/automatedRun/AutomatedRunPlayer";
import PerformanceMeasuringClient from "@foxglove-studio/app/players/automatedRun/performanceMeasuringClient";
import videoRecordingClient from "@foxglove-studio/app/players/automatedRun/videoRecordingClient";
import { NotifyPlayerManagerReplyData, Player } from "@foxglove-studio/app/players/types";
import {
  inVideoRecordingMode,
  inPlaybackPerformanceMeasuringMode,
} from "@foxglove-studio/app/util/inAutomatedRunMode";
import { getSeekToTime } from "@foxglove-studio/app/util/time";

export type BuildPlayerOptions = { unlimitedMemoryCache: boolean; diskBagCaching: boolean };

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
        children: [
          {
            name: CoreDataProviders.RewriteBinaryDataProvider,
            args: {},
            children: [childDescriptor],
          },
        ],
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
    metricsCollector: undefined,
    seekToTime: getSeekToTime(),
    notifyPlayerManager: async (): Promise<NotifyPlayerManagerReplyData | undefined> => {
      // no-op
      return;
    },
  });
}
