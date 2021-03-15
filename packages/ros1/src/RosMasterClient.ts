// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URL } from "whatwg-url";

import { XmlRpcClient, XmlRpcResponse } from "./XmlRpcTypes";

export class RosMasterClient {
  #client: XmlRpcClient;

  constructor(options: { xmlRpcClient: XmlRpcClient }) {
    this.#client = options.xmlRpcClient;
  }

  url(): URL {
    return this.#client.serverUrl;
  }

  registerService(
    callerId: string,
    service: string,
    serviceApi: string,
    callerApi: string,
  ): Promise<XmlRpcResponse> {
    return this.#client.methodCall("registerService", [callerId, service, serviceApi, callerApi]);
  }

  unregisterService(
    callerId: string,
    service: string,
    serviceApi: string,
  ): Promise<XmlRpcResponse> {
    return this.#client.methodCall("unregisterService", [callerId, service, serviceApi]);
  }

  registerSubscriber(
    callerId: string,
    topic: string,
    topicType: string,
    callerApi: string,
  ): Promise<XmlRpcResponse> {
    return this.#client.methodCall("registerSubscriber", [callerId, topic, topicType, callerApi]);
  }

  unregisterSubscriber(
    callerId: string,
    topic: string,
    callerApi: string,
  ): Promise<XmlRpcResponse> {
    return this.#client.methodCall("unregisterSubscriber", [callerId, topic, callerApi]);
  }

  registerPublisher(
    callerId: string,
    topic: string,
    topicType: string,
    callerApi: string,
  ): Promise<XmlRpcResponse> {
    return this.#client.methodCall("registerPublisher", [callerId, topic, topicType, callerApi]);
  }

  unregisterPublisher(callerId: string, topic: string, callerApi: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("unregisterPublisher", [callerId, topic, callerApi]);
  }

  lookupNode(callerId: string, nodeName: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("lookupNode", [callerId, nodeName]);
  }

  getPublishedTopics(callerId: string, subgraph: string = ""): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getPublishedTopics", [callerId, subgraph]);
  }

  getTopicTypes(callerId: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getTopicTypes", [callerId]);
  }

  getSystemState(callerId: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getSystemState", [callerId]);
  }

  getUri(callerId: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("getUri", [callerId]);
  }

  lookupService(callerId: string, service: string): Promise<XmlRpcResponse> {
    return this.#client.methodCall("lookupService", [callerId, service]);
  }
}
