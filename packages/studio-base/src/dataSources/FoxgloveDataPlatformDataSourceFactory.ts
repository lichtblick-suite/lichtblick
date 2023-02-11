// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer, WorkerIterableSource } from "@foxglove/studio-base/players/IterablePlayer";
import { Player } from "@foxglove/studio-base/players/types";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

class FoxgloveDataPlatformDataSourceFactory implements IDataSourceFactory {
  public id = "foxglove-data-platform";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Foxglove Data Platform";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";
  public hidden = true;

  #consoleApi: ConsoleApi;

  public constructor(consoleApi: ConsoleApi) {
    this.#consoleApi = consoleApi;
  }

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const source = new WorkerIterableSource({
      initWorker: () => {
        return new Worker(
          new URL(
            "@foxglove/studio-base/players/IterablePlayer/foxglove-data-platform/DataPlatformIterableSourceWorker.worker",
            import.meta.url,
          ),
        );
      },
      initArgs: {
        api: {
          baseUrl: this.#consoleApi.getBaseUrl(),
          auth: this.#consoleApi.getAuthHeader(),
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
