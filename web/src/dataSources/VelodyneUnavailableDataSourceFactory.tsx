// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link } from "@mui/material";

import { IDataSourceFactory, VelodyneDataSourceFactory } from "@foxglove/studio-base";

export default class VelodyneUnavailableDataSourceFactory extends VelodyneDataSourceFactory {
  public disabledReason = (
    <>
      Velodyne connections require UDP sockets, which are not available in a web browser.{" "}
      <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
        Download our desktop app
      </Link>{" "}
      to connect to a Velodyne sensor.
    </>
  );

  public override initialize(): ReturnType<IDataSourceFactory["initialize"]> {
    return;
  }
}
