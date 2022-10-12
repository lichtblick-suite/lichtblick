// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer, WorkerIterableSource } from "@foxglove/studio-base/players/IterablePlayer";
import { Player } from "@foxglove/studio-base/players/types";

class FoxgloveDataPlatformDataSourceFactory implements IDataSourceFactory {
  public id = "foxglove-data-platform";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Foxglove Data Platform";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";
  public hidden = true;

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const consoleApi = args.consoleApi;
    if (!consoleApi) {
      return;
    }

    const source = new WorkerIterableSource({
      sourceType: "foxgloveDataPlatform",
      initArgs: {
        api: {
          baseUrl: consoleApi.getBaseUrl(),
          auth: consoleApi.getAuthHeader(),
        },
        params: args.params,
      },
    });

    const definedParams: Record<string, string> = {};
    if (args.params) {
      for (const [key, value] of Object.entries(args.params)) {
        if (value != undefined) {
          definedParams[key] = value;
        }
      }
    }

    return new IterablePlayer({
      metricsCollector: args.metricsCollector,
      source,
      sourceId: this.id,
      urlParams: definedParams,
    });
  }
}

export default FoxgloveDataPlatformDataSourceFactory;
