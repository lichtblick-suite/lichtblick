// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import RosboardPlayer from "@lichtblick/suite-base/players/RosboardPlayer";
import { Player } from "@lichtblick/suite-base/players/types";

class RosboardDataSourceFactory implements IDataSourceFactory {
  public id = "rosboard-websocket";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Rosboard";
  public iconName: IDataSourceFactory["iconName"] = "Flow";
  public docsLinks = [
    {
      url: "https://github.com/kiwicampus/studio/tree/kiwi-main?tab=readme-ov-file#connecting-to-rosboard",
    },
  ];
  public description = "Connect to a ROS 1 or ROS 2 system using the Rosboard WebSocket protocol.";

  public formConfig = {
    fields: [
      {
        id: "url",
        label: "WebSocket URL",
        defaultValue: "ws://localhost:8888/rosboard/v1",
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

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.params?.url;
    if (!url) {
      return;
    }

    return new RosboardPlayer({ url, metricsCollector: args.metricsCollector, sourceId: this.id });
  }
}

export default RosboardDataSourceFactory;
