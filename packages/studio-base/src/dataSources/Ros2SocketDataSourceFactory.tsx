// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { PromptOptions } from "@foxglove/studio-base/hooks/usePrompt";
import Ros2Player from "@foxglove/studio-base/players/Ros2Player";
import { Player } from "@foxglove/studio-base/players/types";

class Ros2SocketDataSourceFactory implements IDataSourceFactory {
  id = "ros2-socket";
  displayName = "ROS 2";
  iconName: IDataSourceFactory["iconName"] = "studio.ROS";

  promptOptions(previousValue?: string): PromptOptions {
    return {
      title: "ROS_DOMAIN_ID",
      placeholder: "0",
      initialValue: previousValue ?? "0",
      transformer: (str) => {
        const result = parseInt(str);
        if (isNaN(result) || result < 0) {
          throw new Error("Invalid ROS 2 DomainId. Please use a non-negative integer");
        }
        return String(result);
      },
    };
  }

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
