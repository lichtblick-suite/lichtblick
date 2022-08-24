// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@foxglove/studio-base/players/IterablePlayer";
import { RosDb3IterableSource } from "@foxglove/studio-base/players/IterablePlayer/rosdb3";
import { Player } from "@foxglove/studio-base/players/types";

class Ros2LocalBagDataSourceFactory implements IDataSourceFactory {
  public id = "ros2-local-bagfile";
  public type: IDataSourceFactory["type"] = "file";
  public displayName = "ROS 2 Bag";
  public iconName: IDataSourceFactory["iconName"] = "OpenFile";
  public supportedFileTypes = [".db3"];
  public supportsMultiFile = true;

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const files = args.file ? [args.file] : args.files;
    const name = args.file ? args.file.name : args.files?.map((file) => file.name).join(", ");

    if (!files) {
      return undefined;
    }

    const bagSource = new RosDb3IterableSource(files);
    return new IterablePlayer({
      metricsCollector: args.metricsCollector,
      source: bagSource,
      name,
      sourceId: this.id,
    });
  }
}

export default Ros2LocalBagDataSourceFactory;
