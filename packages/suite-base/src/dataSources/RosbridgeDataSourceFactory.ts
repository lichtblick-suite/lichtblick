// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import RosbridgePlayer from "@lichtblick/suite-base/players/RosbridgePlayer";
import { Player } from "@lichtblick/suite-base/players/types";

class RosbridgeDataSourceFactory implements IDataSourceFactory {
  public id = "rosbridge-websocket";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Rosbridge";
  public iconName: IDataSourceFactory["iconName"] = "Flow";
  public docsLinks = [
    { url: "https://lichtblick-suite.github.io/docs/connecting-to-data/rosbridge.html" },
  ];
  public description = "Connect to a ROS 1 or ROS 2 system using the Rosbridge WebSocket protocol.";

  public formConfig = {
    fields: [
      {
        id: "url",
        label: "WebSocket URL",
        defaultValue: "ws://localhost:9090",
        validate: (newValue: string): Error | undefined => {
          try {
            const url = new URL(newValue);
            if (url.protocol !== "ws:" && url.protocol !== "wss:") {
              return new Error(`Invalid protocol: ${url.protocol}`);
            }
            return undefined;
          } catch (err: unknown) {
            console.error(err);
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

    return new RosbridgePlayer({ url, metricsCollector: args.metricsCollector, sourceId: this.id });
  }
}

export default RosbridgeDataSourceFactory;
