// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { PromptOptions } from "@foxglove/studio-base/hooks/usePrompt";
import Ros1Player from "@foxglove/studio-base/players/Ros1Player";
import { Player } from "@foxglove/studio-base/players/types";
import { parseInputUrl } from "@foxglove/studio-base/util/url";

class Ros1SocketDataSourceFactory implements IDataSourceFactory {
  id = "ros1-socket";
  displayName = "ROS 1";
  iconName: IDataSourceFactory["iconName"] = "studio.ROS";

  promptOptions(previousValue?: string): PromptOptions {
    const os = OsContextSingleton; // workaround for https://github.com/webpack/webpack/issues/12960

    return {
      title: "ROS 1 TCP connection",
      placeholder: "localhost:11311",
      initialValue: previousValue ?? os?.getEnvVar("ROS_MASTER_URI") ?? "localhost:11311",
      transformer: (str) => {
        const result = parseInputUrl(str, "ros:", {
          "http:": { port: 80 },
          "https:": { port: 443 },
          "ros:": { protocol: "http:", port: 11311 },
        });
        if (result == undefined) {
          throw new Error(
            "Invalid ROS URL. See the ROS_MASTER_URI at http://wiki.ros.org/ROS/EnvironmentVariables for more info.",
          );
        }
        return result;
      },
    };
  }

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.url;
    if (!url) {
      return;
    }

    const hostname = args?.rosHostname ?? "localhost";
    return new Ros1Player({
      url,
      hostname,
      metricsCollector: args.metricsCollector,
    });
  }
}

export default Ros1SocketDataSourceFactory;
