// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import { Player } from "@foxglove/studio-base/players/types";
import Ros1MemoryCacheDataProvider from "@foxglove/studio-base/randomAccessDataProviders/Ros1MemoryCacheDataProvider";
import WorkerBagDataProvider from "@foxglove/studio-base/randomAccessDataProviders/WorkerBagDataProvider";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

class Ros1RemoteBagDataSourceFactory implements IDataSourceFactory {
  id = "ros1-remote-bagfile";
  type: IDataSourceFactory["type"] = "remote-file";
  displayName = "ROS 1 Bag (remote)";
  iconName: IDataSourceFactory["iconName"] = "FileASPX";
  supportedFileTypes = [".bag"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.url;
    if (!url) {
      return;
    }

    const bagWorkerDataProvider = new WorkerBagDataProvider({ type: "remote", url });
    const messageCacheProvider = new Ros1MemoryCacheDataProvider(bagWorkerDataProvider, {
      unlimitedCache: args.unlimitedMemoryCache,
    });

    return new RandomAccessPlayer(messageCacheProvider, {
      metricsCollector: args.metricsCollector,
      seekToTime: getSeekToTime(),
      // Overridden to 500ms to limit the number of blocks that need to be
      // fetched per seek from the potentially slow remote data source
      seekBackNs: BigInt(0.5e9),
      name: url,
      urlParams: {
        url,
      },
    });
  }
}

export default Ros1RemoteBagDataSourceFactory;
