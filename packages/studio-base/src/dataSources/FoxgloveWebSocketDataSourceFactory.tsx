// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import FoxgloveWebSocketPlayer from "@foxglove/studio-base/players/FoxgloveWebSocketPlayer";
import { Player } from "@foxglove/studio-base/players/types";

export default class FoxgloveWebSocketDataSourceFactory implements IDataSourceFactory {
  id = "foxglove-websocket";
  type: IDataSourceFactory["type"] = "connection";
  displayName = "Foxglove WebSocket";
  iconName: IDataSourceFactory["iconName"] = "Flow";

  formConfig = {
    fields: [{ id: "url", label: "WebSocket URL", defaultValue: "ws://localhost:8765" }],
  };

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.url;
    if (!url) {
      return;
    }

    return new FoxgloveWebSocketPlayer({
      url,
      metricsCollector: args.metricsCollector,
    });
  }
}
