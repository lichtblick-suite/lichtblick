// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { PromptOptions } from "@foxglove/studio-base/hooks/usePrompt";
import VelodynePlayer, {
  DEFAULT_VELODYNE_PORT,
} from "@foxglove/studio-base/players/VelodynePlayer";
import { Player } from "@foxglove/studio-base/players/types";

class VelodyneDataSourceFactory implements IDataSourceFactory {
  id = "velodyne-device";
  displayName = "Velodyne LIDAR";
  iconName: IDataSourceFactory["iconName"] = "GenericScan";

  promptOptions(previousValue?: string): PromptOptions {
    return {
      title: "Velodyne LIDAR UDP port",
      placeholder: `${DEFAULT_VELODYNE_PORT}`,
      initialValue: previousValue ?? `${DEFAULT_VELODYNE_PORT}`,
      transformer: (str) => {
        const parsed = parseInt(str);
        if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
          throw new Error(
            "Invalid port number. Please enter a valid UDP port number to listen for Velodyne packets",
          );
        }
        return parsed.toString();
      },
    };
  }

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    // velodyne uses the url arg as the port
    const port = args.url as number | undefined;
    if (port == undefined) {
      return;
    }

    return new VelodynePlayer({ port, metricsCollector: args.metricsCollector });
  }
}

export default VelodyneDataSourceFactory;
