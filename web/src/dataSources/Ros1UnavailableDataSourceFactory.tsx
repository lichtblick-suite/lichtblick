// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link } from "@mui/material";

import { IDataSourceFactory, Ros1SocketDataSourceFactory } from "@foxglove/studio-base";

class Ros1UnavailableDataSourceFactory extends Ros1SocketDataSourceFactory {
  public disabledReason = (
    <>
      Native ROS 1 connections require TCP sockets, which are not available in a web browser. We
      recommend using the{" "}
      <Link
        href="https://foxglove.dev/docs/studio/connection/ros1#live-connection"
        target="_blank"
        rel="noreferrer"
      >
        Foxglove WebSocket
      </Link>{" "}
      connection instead.
    </>
  );

  public override initialize(): ReturnType<IDataSourceFactory["initialize"]> {
    return;
  }
}

export default Ros1UnavailableDataSourceFactory;
