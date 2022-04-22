// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import RosbridgePlayer from "@foxglove/studio-base/players/RosbridgePlayer";
import { Player } from "@foxglove/studio-base/players/types";

class RosbridgeDataSourceFactory implements IDataSourceFactory {
  id = "rosbridge-websocket";
  type: IDataSourceFactory["type"] = "connection";
  displayName = "Rosbridge (ROS 1 & 2)";
  iconName: IDataSourceFactory["iconName"] = "Flow";
  docsLink = "https://foxglove.dev/docs/studio/connection/rosbridge";
  description =
    "Connect to a running ROS 1 or ROS 2 system over WebSockets using the rosbridge_suite package.";

  formConfig = {
    fields: [
      {
        id: "url",
        label: "WebSocket URL",
        defaultValue: "ws://localhost:9090",
        validate: (newValue: string): Error | undefined => {
          try {
            const url = new URL(newValue);
            if (url.protocol !== "ws:" && url.protocol !== "wss:") {
              return new Error(`Invalid protocol: ${url.protocol}`);
            }
            return undefined;
          } catch (err) {
            return new Error("Enter a valid url");
          }
        },
      },
    ],
  };

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.url;
    if (!url) {
      return;
    }

    return new RosbridgePlayer({ url, metricsCollector: args.metricsCollector });
  }
}

export default RosbridgeDataSourceFactory;
