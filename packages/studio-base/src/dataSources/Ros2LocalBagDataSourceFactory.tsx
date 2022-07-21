// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import { Player } from "@foxglove/studio-base/players/types";
import MemoryCacheDataProvider from "@foxglove/studio-base/randomAccessDataProviders/MemoryCacheDataProvider";
import WorkerRosbag2DataProvider from "@foxglove/studio-base/randomAccessDataProviders/WorkerRosbag2DataProvider";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

class Ros2LocalBagDataSourceFactory implements IDataSourceFactory {
  id = "ros2-local-bagfile";
  type: IDataSourceFactory["type"] = "file";
  displayName = "ROS 2 Bag";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".db3"];
  supportsMultiFile = true;

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    if ((args.files?.length ?? 0) > 0) {
      const bagWorkerDataProvider = new WorkerRosbag2DataProvider({
        type: "files",
        files: args.files ?? [],
      });

      const messageCacheProvider = new MemoryCacheDataProvider(bagWorkerDataProvider);

      return new RandomAccessPlayer(messageCacheProvider, {
        metricsCollector: args.metricsCollector,
        seekToTime: getSeekToTime(),
        sourceId: this.id,
      });
    } else if (args.file) {
      const bagWorkerDataProvider = new WorkerRosbag2DataProvider({
        type: "file",
        file: args.file,
      });

      const messageCacheProvider = new MemoryCacheDataProvider(bagWorkerDataProvider);

      return new RandomAccessPlayer(messageCacheProvider, {
        metricsCollector: args.metricsCollector,
        seekToTime: getSeekToTime(),
        name: args.file.name,
        sourceId: this.id,
      });
    }

    return undefined;
  }
}

export default Ros2LocalBagDataSourceFactory;
