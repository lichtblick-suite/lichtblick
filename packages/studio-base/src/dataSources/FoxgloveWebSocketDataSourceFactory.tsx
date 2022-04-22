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
  description =
    "Connect live to your custom data via an encoding-agnostic WebSocket connection. Using this data source usualy requires writing a custom server.";
  docsLink = "https://foxglove.dev/docs/studio/connection/foxglove-websocket";

  formConfig = {
    fields: [
      {
        id: "url",
        label: "WebSocket URL",
        defaultValue: "ws://localhost:8765",
        validate: (newValue: string): Error | undefined => {
          try {
            const url = new URL(newValue);
            if (url.protocol !== "ws:" && url.protocol !== "wss:") {
              return new Error(`Invalid protocol: ${url.protocol}`);
            }
            return undefined;
          } catch (err) {
            return new Error("Enter a valid url");
          }
        },
      },
    ],
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
