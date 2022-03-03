// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import Ros1MemoryCacheDataProvider from "@foxglove/studio-base/randomAccessDataProviders/Ros1MemoryCacheDataProvider";
import WorkerBagDataProvider from "@foxglove/studio-base/randomAccessDataProviders/WorkerBagDataProvider";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

import * as SampleNuscenesLayout from "./SampleNuscenesLayout.json";

class SampleNuscenesDataSourceFactory implements IDataSourceFactory {
  id = "sample-nuscenes";
  type: IDataSourceFactory["type"] = "sample";
  displayName = "Sample: Nuscenes";
  iconName: IDataSourceFactory["iconName"] = "FileASPX";
  hidden = true;
  sampleLayout = SampleNuscenesLayout as IDataSourceFactory["sampleLayout"];

  initialize(args: DataSourceFactoryInitializeArgs): ReturnType<IDataSourceFactory["initialize"]> {
    const bagUrl =
      "https://storage.googleapis.com/foxglove-public-assets/nuScenes-v1.0-mini-scene-0061.bag";
    const bagWorkerDataProvider = new WorkerBagDataProvider({ type: "remote", url: bagUrl });
    const messageCacheProvider = new Ros1MemoryCacheDataProvider(bagWorkerDataProvider, {
      unlimitedCache: args.unlimitedMemoryCache,
    });

    return new RandomAccessPlayer(messageCacheProvider, {
      isSampleDataSource: true,
      metricsCollector: args.metricsCollector,
      seekToTime: getSeekToTime(),
      name: "Adapted from nuScenes dataset.\nCopyright © 2020 nuScenes.\nhttps://www.nuscenes.org/terms-of-use",
      // Use blank url params so the data source is set in the url
      urlParams: {},
    });
  }
}

export default SampleNuscenesDataSourceFactory;
