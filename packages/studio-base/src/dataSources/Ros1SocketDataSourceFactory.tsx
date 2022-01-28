// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosNode } from "@foxglove/ros1";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import Ros1Player from "@foxglove/studio-base/players/Ros1Player";
import { Player } from "@foxglove/studio-base/players/types";

const os = OsContextSingleton; // workaround for https://github.com/webpack/webpack/issues/12960

class Ros1SocketDataSourceFactory implements IDataSourceFactory {
  id = "ros1-socket";
  type: IDataSourceFactory["type"] = "connection";
  displayName = "ROS 1";
  iconName: IDataSourceFactory["iconName"] = "studio.ROS";

  formConfig = {
    fields: [
      {
        id: "url",
        label: "ROS_MASTER_URI",
        defaultValue: os?.getEnvVar("ROS_MASTER_URI") ?? "http://localhost:11311",
      },
      {
        id: "hostname",
        label: "ROS_HOSTNAME",
        defaultValue: os
          ? RosNode.GetRosHostname(os.getEnvVar, os.getHostname, os.getNetworkInterfaces)
          : "localhost",
      },
    ],
  };

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.url;
    if (!url) {
      return;
    }

    const hostname = args.hostname ?? "localhost";
    if (typeof hostname !== "string") {
      throw new Error(`Unable to initialize Ros1. Invalid hostname ${hostname}`);
    }

    return new Ros1Player({
      url,
      hostname,
      metricsCollector: args.metricsCollector,
    });
  }
}

export default Ros1SocketDataSourceFactory;
