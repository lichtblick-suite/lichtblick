// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { buildNonRos1PlayerFromDescriptor } from "@foxglove/studio-base/players/buildNonRos1Player";
import { Player } from "@foxglove/studio-base/players/types";
import { getLocalRosbag2Descriptor } from "@foxglove/studio-base/randomAccessDataProviders/standardDataProviderDescriptors";

class Ros2LocalBagDataSourceFactory implements IDataSourceFactory {
  id = "ros2-local-bagfile";
  displayName = "ROS 2 Bag (local)";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".db3"];
  supportsMultiFile = true;

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    if ((args.files?.length ?? 0) > 0) {
      const files = args.files as File[];
      return buildNonRos1PlayerFromDescriptor(files[0]!.name, getLocalRosbag2Descriptor(files), {
        metricsCollector: args.metricsCollector,
        unlimitedMemoryCache: args.unlimitedMemoryCache,
      });
    } else if (args.file) {
      const file = args.file;
      return buildNonRos1PlayerFromDescriptor(file.name, getLocalRosbag2Descriptor(file), {
        metricsCollector: args.metricsCollector,
        unlimitedMemoryCache: args.unlimitedMemoryCache,
      });
    }

    return undefined;
  }
}

export default Ros2LocalBagDataSourceFactory;
