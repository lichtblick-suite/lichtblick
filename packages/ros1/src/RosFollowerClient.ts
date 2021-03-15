// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URL } from "whatwg-url";

import { XmlRpcClient, XmlRpcResponse, XmlRpcValue } from "./XmlRpcTypes";

export type ProtocolParams = [string, ...XmlRpcValue[]];

export class RosFollowerClient {
  #client: XmlRpcClient;

  constructor(options: { xmlRpcClient: XmlRpcClient }) {
    this.#client = options.xmlRpcClient;
  }

  url(): URL {
    return this.#client.serverUrl;
  }

  getBusStats(callerId: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getBusStats", [callerId]);
  }

  getBusInfo(callerId: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getBusInfo", [callerId]);
  }

  shutdown(callerId: string, msg = ""): Promise<XmlRpcResponse> {
    return this.#client.methodCall("shutdown", [callerId, msg]);
  }

  async getPid(callerId: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getPid", [callerId]);
  }

  getSubscriptions(callerId: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getSubscriptions", [callerId]);
  }

  getPublications(callerId: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getPublications", [callerId]);
  }

  paramUpdate(
    callerId: string,
    parameterKey: string,
    parameterValue: XmlRpcValue,
  ): Promise<XmlRpcResponse> {
    return this.#client.methodCall("paramUpdate", [callerId, parameterKey, parameterValue]);
  }

  publisherUpdate(callerId: string, topic: string, publishers: string[]): Promise<XmlRpcResponse> {
    return this.#client.methodCall("publisherUpdate", [callerId, topic, publishers]);
  }

  requestTopic(
    callerId: string,
    topic: string,
    protocols: ProtocolParams[],
  ): Promise<XmlRpcResponse> {
    return this.#client.methodCall("requestTopic", [callerId, topic, protocols]);
  }
}
