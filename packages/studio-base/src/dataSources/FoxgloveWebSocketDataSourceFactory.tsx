// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { PromptOptions } from "@foxglove/studio-base/hooks/usePrompt";
import FoxgloveWebSocketPlayer from "@foxglove/studio-base/players/FoxgloveWebSocketPlayer";
import { Player } from "@foxglove/studio-base/players/types";
import { parseInputUrl } from "@foxglove/studio-base/util/url";

export default class FoxgloveWebSocketDataSourceFactory implements IDataSourceFactory {
  id = "foxglove-websocket";
  type: IDataSourceFactory["type"] = "connection";
  displayName = "Foxglove WebSocket";
  iconName: IDataSourceFactory["iconName"] = "Flow";

  formConfig = {
    fields: [{ id: "url", label: "Websocket URL", defaultValue: "ws://localhost:9090" }],
  };

  promptOptions(previousValue?: string): PromptOptions {
    return {
      title: "WebSocket connection",
      placeholder: "ws://localhost:8765",
      initialValue: previousValue ?? "ws://localhost:8765",
      transformer: (str) => {
        const result = parseInputUrl(str, "ws:", {
          "http:": { protocol: "ws:", port: 8765 },
          "https:": { protocol: "wss:", port: 8765 },
          "ws:": { port: 8765 },
          "wss:": { port: 8765 },
        });
        if (result == undefined) {
          throw new Error("Invalid WebSocket URL. Use the ws:// or wss:// protocol.");
        }
        return result;
      },
    };
  }

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
