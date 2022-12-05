// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer, WorkerIterableSource } from "@foxglove/studio-base/players/IterablePlayer";
import { Player } from "@foxglove/studio-base/players/types";

class Ros1RemoteBagDataSourceFactory implements IDataSourceFactory {
  public id = "ros1-remote-bagfile";
  public type: IDataSourceFactory["type"] = "remote-file";
  public displayName = "ROS 1 Bag";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";
  public supportedFileTypes = [".bag"];
  public description = "Fetch and load pre-recorded ROS 1 .bag files from a remote location.";
  public docsLink = "https://foxglove.dev/docs/studio/connection/ros1-bag";

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.params?.url;
    if (!url) {
      return;
    }

    const source = new WorkerIterableSource({
      sourceType: "rosbag",
      initArgs: { url },
    });

    return new IterablePlayer({
      source,
      isSampleDataSource: true,
      name: url,
      metricsCollector: args.metricsCollector,
      // Use blank url params so the data source is set in the url
      urlParams: {
        url,
      },
      sourceId: this.id,
    });
  }
}

export default Ros1RemoteBagDataSourceFactory;
