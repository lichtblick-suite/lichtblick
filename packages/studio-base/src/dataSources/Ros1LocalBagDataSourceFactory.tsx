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

class Ros1LocalBagDataSourceFactory implements IDataSourceFactory {
  id = "ros1-local-bagfile";
  type: IDataSourceFactory["type"] = "file";
  displayName = "ROS 1 Bag";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".bag"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const file = args.file;
    if (!file) {
      return;
    }

    const bagWorkerDataProvider = new WorkerBagDataProvider({ type: "file", file });
    const messageCacheProvider = new Ros1MemoryCacheDataProvider(bagWorkerDataProvider, {
      unlimitedCache: args.unlimitedMemoryCache,
    });

    return new RandomAccessPlayer(messageCacheProvider, {
      metricsCollector: args.metricsCollector,
      seekToTime: getSeekToTime(),
      name: file.name,
    });
  }
}

export default Ros1LocalBagDataSourceFactory;
