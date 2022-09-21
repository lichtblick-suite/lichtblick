// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import VelodynePlayer from "@foxglove/studio-base/players/VelodynePlayer";
import { Player } from "@foxglove/studio-base/players/types";

class VelodyneDataSourceFactory implements IDataSourceFactory {
  public id = "velodyne-device";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Velodyne LIDAR";
  public iconName: IDataSourceFactory["iconName"] = "GenericScan";
  public description =
    "Connect directly to Velodyne LIDAR hardware to inspect incoming sensor data.";
  public docsLink = "https://foxglove.dev/docs/studio/connection/velodyne";

  public formConfig = {
    fields: [{ id: "url", label: "UDP Port", defaultValue: "2369" }],
  };

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    // velodyne uses the url arg as the port
    const port = args.url as number | undefined;
    if (port == undefined) {
      return;
    }

    return new VelodynePlayer({ port, metricsCollector: args.metricsCollector });
  }
}

export default VelodyneDataSourceFactory;
