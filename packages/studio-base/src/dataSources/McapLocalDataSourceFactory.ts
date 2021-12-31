// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import { Player } from "@foxglove/studio-base/players/types";
import McapDataProvider from "@foxglove/studio-base/randomAccessDataProviders/McapDataProvider";
import MemoryCacheDataProvider from "@foxglove/studio-base/randomAccessDataProviders/MemoryCacheDataProvider";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

class McapLocalDataSourceFactory implements IDataSourceFactory {
  id = "mcap-local-file";
  type: IDataSourceFactory["type"] = "file";
  displayName = "MCAP";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".mcap"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const file = args.file;
    if (!file) {
      return;
    }

    const mcapProvider = new McapDataProvider({ file });
    const messageCacheProvider = new MemoryCacheDataProvider(mcapProvider, {
      unlimitedCache: args.unlimitedMemoryCache,
    });

    return new RandomAccessPlayer(messageCacheProvider, {
      metricsCollector: args.metricsCollector,
      seekToTime: getSeekToTime(),
      name: file.name,
    });
  }
}

export default McapLocalDataSourceFactory;
