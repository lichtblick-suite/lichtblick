// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import Ros2Player from "@foxglove/studio-base/players/Ros2Player";
import { Player } from "@foxglove/studio-base/players/types";

class Ros2SocketDataSourceFactory implements IDataSourceFactory {
  id = "ros2-socket";
  type: IDataSourceFactory["type"] = "connection";
  displayName = "ROS 2";
  iconName: IDataSourceFactory["iconName"] = "studio.ROS";

  formConfig = {
    fields: [{ id: "url", label: "ROS_DOMAIN_ID", defaultValue: "0" }],
  };

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.url;
    if (!url) {
      return;
    }

    const domainIdStr = url;
    const domainId = parseInt(domainIdStr);

    return new Ros2Player({ domainId, metricsCollector: args.metricsCollector });
  }
}

export default Ros2SocketDataSourceFactory;
