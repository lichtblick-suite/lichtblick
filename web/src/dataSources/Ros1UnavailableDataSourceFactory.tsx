// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link } from "@mui/material";

import { IDataSourceFactory, Ros1SocketDataSourceFactory } from "@foxglove/studio-base";

class Ros1UnavailableDataSourceFactory extends Ros1SocketDataSourceFactory {
  public disabledReason = (
    <>
      ROS 1 connections require TCP sockets, which are not available in a web browser.{" "}
      <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
        Download our desktop app
      </Link>{" "}
      to connect to a ROS 1 system.
    </>
  );

  public override initialize(): ReturnType<IDataSourceFactory["initialize"]> {
    return;
  }
}

export default Ros1UnavailableDataSourceFactory;
