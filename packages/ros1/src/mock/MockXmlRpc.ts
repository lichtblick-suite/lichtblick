// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { XmlRpcValue } from "@foxglove/xmlrpc";

import type { RosXmlRpcResponse } from "../XmlRpcTypes";

const TURTLESIM_SERVICES = new Set([
  "/turtlesim/get_loggers",
  "/turtlesim/set_logger_level",
  "/clear",
  "/reset",
  "/spawn",
  "/kill",
  "/turtle1/set_pen",
  "/turtle1/teleport_relative",
  "/turtle1/teleport_absolute",
  "/rosout/get_loggers",
  "/rosout/set_logger_level",
]);

export class XmlRpcClientMock {
  readonly serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async methodCall(method: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> {
    switch (method) {
      case "getPublishedTopics":
        return Promise.resolve([
          1,
          "current topics",
          [
            ["/rosout", "rosgraph_msgs/Log"],
            ["/turtle1/pose", "turtlesim/Pose"],
            ["/turtle1/color_sensor", "turtlesim/Color"],
            ["/rosout_agg", "rosgraph_msgs/Log"],
          ],
        ]);
      case "getSystemState":
        return Promise.resolve([
          1,
          "current system state",
          [
            [
              ["/rosout", ["/turtlesim"]],
              ["/turtle1/pose", ["/turtlesim"]],
              ["/turtle1/color_sensor", ["/turtlesim"]],
              ["/rosout_agg", ["/rosout"]],
            ],
            [
              ["/turtle1/cmd_vel", ["/turtlesim"]],
              ["/rosout", ["/rosout"]],
            ],
            [
              ["/turtlesim/get_loggers", ["/turtlesim"]],
              ["/turtlesim/set_logger_level", ["/turtlesim"]],
              ["/clear", ["/turtlesim"]],
              ["/reset", ["/turtlesim"]],
              ["/spawn", ["/turtlesim"]],
              ["/kill", ["/turtlesim"]],
              ["/turtle1/set_pen", ["/turtlesim"]],
              ["/turtle1/teleport_relative", ["/turtlesim"]],
              ["/turtle1/teleport_absolute", ["/turtlesim"]],
              ["/rosout/get_loggers", ["/rosout"]],
              ["/rosout/set_logger_level", ["/rosout"]],
            ],
          ],
        ]);
      case "getTopicTypes":
        return Promise.resolve([
          1,
          "current system state", // Not a typo
          [
            ["/rosout", "rosgraph_msgs/Log"],
            ["/turtle1/cmd_vel", "geometry_msgs/Twist"],
            ["/turtle1/pose", "turtlesim/Pose"],
            ["/turtle1/color_sensor", "turtlesim/Color"],
            ["/rosout_agg", "rosgraph_msgs/Log"],
          ],
        ]);
      case "getUri":
        return Promise.resolve([1, "", "http://localhost:11311/"]);
      case "lookupNode": {
        const nodeName = args[1];
        if (nodeName === "/turtlesim") {
          return Promise.resolve([1, "node api", "http://localhost:39211/"]);
        }
        return Promise.resolve([-1, `unknown node [${nodeName}]`, ""]);
      }
      case "lookupService": {
        const serviceName = args[1];
        if (TURTLESIM_SERVICES.has(serviceName as string)) {
          return Promise.resolve([
            1,
            "rosrpc URI: [rosrpc://localhost:38017]",
            "rosrpc://localhost:38017",
          ]);
        }
        return Promise.resolve([-1, "no provider", ""]);
      }
      case "registerPublisher":
      case "registerService":
        return Promise.resolve([-1, "not implemented", ""]);
      case "registerSubscriber":
        return Promise.resolve([1, "", ["http://localhost:39211/"]]);
      case "unregisterPublisher":
      case "unregisterService":
      case "unregisterSubscriber":
        return Promise.resolve([-1, "not implemented", ""]);
      default:
        return Promise.resolve([-1, `unknown method [${method}]`, ""]);
    }
  }
}
