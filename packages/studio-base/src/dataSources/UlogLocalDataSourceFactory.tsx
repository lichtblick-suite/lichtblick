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
import UlogDataProvider from "@foxglove/studio-base/randomAccessDataProviders/UlogDataProvider";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

class UlogLocalDataSourceFactory implements IDataSourceFactory {
  id = "ulog-local-file";
  type: IDataSourceFactory["type"] = "file";
  displayName = "PX4 ULog";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".ulg", ".ulog"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const file = args.file;
    if (!file) {
      return;
    }

    const ulogDataProvider = new UlogDataProvider({ file });
    const messageCacheProvider = new MemoryCacheDataProvider(ulogDataProvider);

    return new RandomAccessPlayer(messageCacheProvider, {
      metricsCollector: args.metricsCollector,
      seekToTime: getSeekToTime(),
      name: file.name,
      sourceId: this.id,
    });
  }
}

export default UlogLocalDataSourceFactory;
