// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import { URL } from "whatwg-url";

import type {
  XmlRpcClient,
  XmlRpcValue,
  XmlRpcResponse,
  XmlRpcServer,
  HttpAddress,
} from "../XmlRpcTypes";

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

export class XmlRpcClientMock implements XmlRpcClient {
  readonly serverUrl: URL;

  constructor(serverUrl: URL) {
    this.serverUrl = serverUrl;
  }

  methodCall(method: string, args: XmlRpcValue[]): Promise<XmlRpcResponse> {
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

export class XmlRpcServerMock extends EventEmitter implements XmlRpcServer {
  #address?: HttpAddress;

  constructor() {
    super();
    this.#address = { hostname: "localhost", port: 39211, secure: false };
  }

  address(): HttpAddress | undefined {
    return this.#address;
  }

  close(): void {
    this.#address = undefined;
  }

  addMethod(method: string, handler: (args: XmlRpcValue[]) => Promise<XmlRpcResponse>): this {
    this.on(method, (params) => {
      if (!Array.isArray(params)) {
        params = [params];
      }

      handler(params).catch((err) => {
        this.emit("error", err);
      });
    });

    return this;
  }
}

export function XmlRpcCreateClient(options: { url: URL }): Promise<XmlRpcClient> {
  return Promise.resolve(new XmlRpcClientMock(options.url));
}

export function XmlRpcCreateServer(_options: {
  host: string;
  port: number;
}): Promise<XmlRpcServer> {
  return Promise.resolve(new XmlRpcServerMock());
}
