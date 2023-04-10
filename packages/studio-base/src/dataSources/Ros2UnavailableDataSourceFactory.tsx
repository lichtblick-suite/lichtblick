// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link } from "@mui/material";

import { IDataSourceFactory } from "@foxglove/studio-base/context/PlayerSelectionContext";

export default class Ros2UnavailableDataSourceFactory implements IDataSourceFactory {
  public id = "ros2-socket";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "ROS 2";
  public iconName: IDataSourceFactory["iconName"] = "ROS";

  public disabledReason = (
    <>
      Use the{" "}
      <Link
        href="https://foxglove.dev/docs/studio/connection/ros2#foxglove-websocket"
        target="_blank"
        rel="noreferrer"
      >
        Foxglove WebSocket
      </Link>{" "}
      connection to connect to your ROS 2 system.
    </>
  );

  public initialize(): ReturnType<IDataSourceFactory["initialize"]> {
    return;
  }
}
