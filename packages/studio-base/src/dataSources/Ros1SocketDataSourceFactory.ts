// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { RosNode } from "@foxglove/ros1";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import Ros1Player from "@foxglove/studio-base/players/Ros1Player";
import { Player } from "@foxglove/studio-base/players/types";

class Ros1SocketDataSourceFactory implements IDataSourceFactory {
  public id = "ros1-socket";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "ROS 1";
  public iconName: IDataSourceFactory["iconName"] = "ROS";
  public description =
    "Connect to a running ROS 1 system via a native TCP connection that accesses your ROS master and nodes directly.";
  public docsLinks = [{ url: "https://foxglove.dev/docs/studio/connection/native" }];

  public formConfig = {
    fields: [
      {
        id: "url",
        label: "ROS_MASTER_URI",
        defaultValue: OsContextSingleton?.getEnvVar("ROS_MASTER_URI") ?? "http://localhost:11311",
        description: "Tells ROS nodes where they can locate the master",
      },
      {
        id: "hostname",
        label: "ROS_HOSTNAME",
        defaultValue: OsContextSingleton
          ? RosNode.GetRosHostname(
              OsContextSingleton.getEnvVar,
              OsContextSingleton.getHostname,
              OsContextSingleton.getNetworkInterfaces,
            )
          : "localhost",
        description: "Acts as the declared network address of a ROS node or tool",
      },
    ],
  };

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.params?.url;
    if (!url) {
      return;
    }

    const hostname = args.params?.hostname;
    if (!_.isUndefined(hostname) && !_.isString(hostname)) {
      throw new Error(`Unable to initialize Ros1. Invalid hostname ${hostname}`);
    }

    return new Ros1Player({
      url,
      hostname,
      metricsCollector: args.metricsCollector,
      sourceId: this.id,
    });
  }
}

export default Ros1SocketDataSourceFactory;
