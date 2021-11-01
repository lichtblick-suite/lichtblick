// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import FoxgloveDataPlatformPlayer from "@foxglove/studio-base/players/FoxgloveDataPlatformPlayer";
import { Player } from "@foxglove/studio-base/players/types";

type FoxgloveDataPlatformOptions = {
  start: string;
  end: string;
  seek?: string;
  deviceId: string;
};

class FoxgloveDataPlatformDataSourceFactory implements IDataSourceFactory {
  id = "foxglove-data-platform";
  displayName = "Foxglove Data Platform";
  iconName: IDataSourceFactory["iconName"] = "FileASPX";
  hidden = true;

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    if (!args.consoleApi) {
      return;
    }

    // This could benefit from schema validation rather than casting
    const start = args.start as string | undefined;
    const end = args.end as string | undefined;
    const deviceId = args.deviceId as string | undefined;
    if (!start || !end || !deviceId) {
      return;
    }

    const params: FoxgloveDataPlatformOptions = {
      start,
      end,
      deviceId,
      seek: args.seek as string | undefined,
    };

    return new FoxgloveDataPlatformPlayer({
      params,
      consoleApi: args.consoleApi,
      metricsCollector: args.metricsCollector,
    });
  }
}

export default FoxgloveDataPlatformDataSourceFactory;
