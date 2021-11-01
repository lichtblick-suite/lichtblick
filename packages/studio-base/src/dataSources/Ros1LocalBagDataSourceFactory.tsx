// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { buildPlayerFromFiles } from "@foxglove/studio-base/players/buildPlayer";
import { Player } from "@foxglove/studio-base/players/types";

class Ros1LocalBagDataSourceFactory implements IDataSourceFactory {
  id = "ros1-local-bagfile";
  displayName = "ROS 1 Bag (local)";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".bag"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const file = args.file;
    if (!file) {
      return;
    }

    return buildPlayerFromFiles([file], {
      unlimitedMemoryCache: args.unlimitedMemoryCache,
      metricsCollector: args.metricsCollector,
    });
  }
}

export default Ros1LocalBagDataSourceFactory;
