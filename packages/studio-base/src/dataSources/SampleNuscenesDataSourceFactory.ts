// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@foxglove/studio-base/players/IterablePlayer";
import { BagIterableSource } from "@foxglove/studio-base/players/IterablePlayer/BagIterableSource";
import RandomAccessPlayer from "@foxglove/studio-base/players/RandomAccessPlayer";
import Ros1MemoryCacheDataProvider from "@foxglove/studio-base/randomAccessDataProviders/Ros1MemoryCacheDataProvider";
import WorkerBagDataProvider from "@foxglove/studio-base/randomAccessDataProviders/WorkerBagDataProvider";
import { getSeekToTime } from "@foxglove/studio-base/util/time";

import SampleNuscenesLayout from "./SampleNuscenesLayout.json";

class SampleNuscenesDataSourceFactory implements IDataSourceFactory {
  id = "sample-nuscenes";
  type: IDataSourceFactory["type"] = "sample";
  displayName = "Sample: Nuscenes";
  iconName: IDataSourceFactory["iconName"] = "FileASPX";
  hidden = true;
  sampleLayout = SampleNuscenesLayout as IDataSourceFactory["sampleLayout"];

  private enableIterablePlayer = false;

  constructor(opt?: { useIterablePlayer: boolean }) {
    this.enableIterablePlayer = opt?.useIterablePlayer ?? false;
  }

  initialize(args: DataSourceFactoryInitializeArgs): ReturnType<IDataSourceFactory["initialize"]> {
    const bagUrl = "https://assets.foxglove.dev/nuScenes-v1.0-mini-scene-0061.bag";

    if (this.enableIterablePlayer) {
      const bagSource = new BagIterableSource({ type: "remote", url: bagUrl });
      return new IterablePlayer({
        source: bagSource,
        isSampleDataSource: true,
        name: "Adapted from nuScenes dataset.\nCopyright © 2020 nuScenes.\nhttps://www.nuscenes.org/terms-of-use",
        metricsCollector: args.metricsCollector,
        // Use blank url params so the data source is set in the url
        urlParams: {},
        sourceId: this.id,
      });
    } else {
      const bagWorkerDataProvider = new WorkerBagDataProvider({ type: "remote", url: bagUrl });
      const messageCacheProvider = new Ros1MemoryCacheDataProvider(bagWorkerDataProvider);

      return new RandomAccessPlayer(messageCacheProvider, {
        isSampleDataSource: true,
        metricsCollector: args.metricsCollector,
        seekToTime: getSeekToTime(),
        name: "Adapted from nuScenes dataset.\nCopyright © 2020 nuScenes.\nhttps://www.nuscenes.org/terms-of-use",
        // Use blank url params so the data source is set in the url
        urlParams: {},
        sourceId: this.id,
      });
    }
  }
}

export default SampleNuscenesDataSourceFactory;
