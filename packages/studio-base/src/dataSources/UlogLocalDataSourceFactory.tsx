// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { buildNonRos1PlayerFromDescriptor } from "@foxglove/studio-base/players/buildNonRos1Player";
import { Player } from "@foxglove/studio-base/players/types";
import { getLocalUlogDescriptor } from "@foxglove/studio-base/randomAccessDataProviders/standardDataProviderDescriptors";

class UlogLocalDataSourceFactory implements IDataSourceFactory {
  id = "ulog-local-file";
  displayName = "PX4 ULog (local)";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".ulg", ".ulog"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const file = args.file;
    if (!file) {
      return;
    }

    return buildNonRos1PlayerFromDescriptor(getLocalUlogDescriptor(file), {
      metricsCollector: args.metricsCollector,
      unlimitedMemoryCache: args.unlimitedMemoryCache,
    });
  }
}

export default UlogLocalDataSourceFactory;
