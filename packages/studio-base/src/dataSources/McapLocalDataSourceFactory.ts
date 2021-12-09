// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { buildNonRos1PlayerFromDescriptor } from "@foxglove/studio-base/players/buildNonRos1Player";
import { Player } from "@foxglove/studio-base/players/types";
import { CoreDataProviders } from "@foxglove/studio-base/randomAccessDataProviders/constants";
import { RandomAccessDataProviderDescriptor } from "@foxglove/studio-base/randomAccessDataProviders/types";

class McapLocalDataSourceFactory implements IDataSourceFactory {
  id = "mcap-local-file";
  displayName = "MCAP (local)";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".mcap"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const file = args.file;
    if (!file) {
      return;
    }

    const descriptor: RandomAccessDataProviderDescriptor = {
      label: file.name,
      name: CoreDataProviders.McapDataProvider,
      filePath: (file as { path?: string }).path, // File.path is added by Electron
      args: { file },
      children: [],
    };

    return buildNonRos1PlayerFromDescriptor(file.name, descriptor, {
      metricsCollector: args.metricsCollector,
      unlimitedMemoryCache: args.unlimitedMemoryCache,
    });
  }
}

export default McapLocalDataSourceFactory;
