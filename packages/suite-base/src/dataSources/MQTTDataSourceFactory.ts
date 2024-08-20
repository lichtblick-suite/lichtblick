// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import MQTTPlayer from "@lichtblick/suite-base/players/MQTTPlayer";
import { Player } from "@lichtblick/suite-base/players/types";

export default class MQTTDataSourceFactory implements IDataSourceFactory {
  public id = "mqtt-websocket";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "MQTT5";
  public iconName: IDataSourceFactory["iconName"] = "Flow";
  public description = "MQTT Transfer Websocket";
  public docsLinks = [
    // {
    //   label: "ROS 1",
    //   url: "https://foxglove.dev/docs/studio/connection/ros1#foxglove-websocket",
    // },
    // {
    //   label: "ROS 2",
    //   url: "https://foxglove.dev/docs/studio/connection/ros2#foxglove-websocket",
    // },
    // {
    //   label: "custom data",
    //   url: "https://foxglove.dev/docs/studio/connection/custom#foxglove-websocket",
    // },
  ];

  public formConfig = {
    fields: [
      {
        id: "url",
        label: "MQTT WS URL",
        defaultValue: "ws://localhost:8083",
        validate: (newValue: string): Error | undefined => {
          try {
            const url = new URL(newValue);
            if (url.protocol !== "mqtt:" && url.protocol !== "ws:") {
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

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.params?.url;
    if (!url) {
      return;
    }

    return new MQTTPlayer({
      url,
      metricsCollector: args.metricsCollector,
      sourceId: this.id,
    });
  }
}
