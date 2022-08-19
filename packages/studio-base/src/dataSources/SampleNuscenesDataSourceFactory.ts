// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@foxglove/studio-base/players/IterablePlayer";
import { BagIterableSource } from "@foxglove/studio-base/players/IterablePlayer/BagIterableSource";

import SampleNuscenesLayout from "./SampleNuscenesLayout.json";

class SampleNuscenesDataSourceFactory implements IDataSourceFactory {
  public id = "sample-nuscenes";
  public type: IDataSourceFactory["type"] = "sample";
  public displayName = "Sample: Nuscenes";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";
  public hidden = true;
  public sampleLayout = SampleNuscenesLayout as IDataSourceFactory["sampleLayout"];

  public initialize(
    args: DataSourceFactoryInitializeArgs,
  ): ReturnType<IDataSourceFactory["initialize"]> {
    const bagUrl = "https://assets.foxglove.dev/nuScenes-v1.0-mini-scene-0061.bag";

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
  }
}

export default SampleNuscenesDataSourceFactory;
