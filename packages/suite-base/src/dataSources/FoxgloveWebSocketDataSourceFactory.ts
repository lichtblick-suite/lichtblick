// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import FoxgloveWebSocketPlayer from "@lichtblick/suite-base/players/FoxgloveWebSocketPlayer";
import { Player } from "@lichtblick/suite-base/players/types";
import i18n from "i18next";

export default class FoxgloveWebSocketDataSourceFactory implements IDataSourceFactory {
  public id = "foxglove-websocket";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = i18n.t("playerMethodInfo:ros2");
  public iconName: IDataSourceFactory["iconName"] = "ROS";
  public description = i18n.t("playerMethodInfo:ros2Description");
  public docsLinks = [
    // {
    //   label: "ROS 1",
    //   url: "https://docs.foxglove.dev/docs/connecting-to-data/frameworks/ros1#foxglove-websocket",
    // },
    // {
    //   label: "ROS 2",
    //   url: "https://docs.foxglove.dev/docs/connecting-to-data/frameworks/ros2#foxglove-websocket",
    // },
  ];

  public formConfig = {
    fields: [
      {
        id: "url",
        label: i18n.t("playerMethodInfo:displayRos2label"),
        defaultValue: "ws://localhost:8765",
        validate: (newValue: string): Error | undefined => {
          try {
            // const url = new URL("ws://" + newValue + ":8765");
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

    return new FoxgloveWebSocketPlayer({
      url,
      metricsCollector: args.metricsCollector,
      sourceId: this.id,
    });
  }
}
