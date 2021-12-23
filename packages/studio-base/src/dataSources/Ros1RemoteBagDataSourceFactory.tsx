// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { PromptOptions } from "@foxglove/studio-base/hooks/usePrompt";
import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import { Player } from "@foxglove/studio-base/players/types";
import Ros1MemoryCacheDataProvider from "@foxglove/studio-base/randomAccessDataProviders/Ros1MemoryCacheDataProvider";
import WorkerBagDataProvider from "@foxglove/studio-base/randomAccessDataProviders/WorkerBagDataProvider";
import { getSeekToTime } from "@foxglove/studio-base/util/time";
import { parseInputUrl } from "@foxglove/studio-base/util/url";

class Ros1RemoteBagDataSourceFactory implements IDataSourceFactory {
  id = "ros1-remote-bagfile";
  type: IDataSourceFactory["type"] = "remote-file";
  displayName = "ROS 1 Bag (remote)";
  iconName: IDataSourceFactory["iconName"] = "FileASPX";
  supportedFileTypes = [".bag"];

  promptOptions(previousValue?: string): PromptOptions {
    return {
      title: "Remote bag file",
      placeholder: "https://example.com/file.bag",
      initialValue: previousValue,
      transformer: (str) => {
        const result = parseInputUrl(str, "https:", {
          "http:": { port: 80 },
          "https:": { port: 443 },
          "ftp:": { port: 21 },
        });
        if (result == undefined) {
          throw new Error(
            "Invalid bag URL. Use a http:// or https:// URL of a web hosted bag file.",
          );
        }
        return result;
      },
    };
  }

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
