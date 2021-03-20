// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosXmlRpcClient } from "./RosXmlRpcClient";
import { RosXmlRpcResponse } from "./XmlRpcTypes";

export class RosMasterClient extends RosXmlRpcClient {
  registerService(
    callerId: string,
    service: string,
    serviceApi: string,
    callerApi: string,
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("registerService", [callerId, service, serviceApi, callerApi]);
  }

  unregisterService(
    callerId: string,
    service: string,
    serviceApi: string,
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("unregisterService", [callerId, service, serviceApi]);
  }

  registerSubscriber(
    callerId: string,
    topic: string,
    topicType: string,
    callerApi: string,
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("registerSubscriber", [callerId, topic, topicType, callerApi]);
  }

  unregisterSubscriber(
    callerId: string,
    topic: string,
    callerApi: string,
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("unregisterSubscriber", [callerId, topic, callerApi]);
  }

  registerPublisher(
    callerId: string,
    topic: string,
    topicType: string,
    callerApi: string,
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("registerPublisher", [callerId, topic, topicType, callerApi]);
  }

  unregisterPublisher(
    callerId: string,
    topic: string,
    callerApi: string,
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("unregisterPublisher", [callerId, topic, callerApi]);
  }

  lookupNode(callerId: string, nodeName: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("lookupNode", [callerId, nodeName]);
  }

  getPublishedTopics(callerId: string, subgraph: string = ""): Promise<RosXmlRpcResponse> {
    return this._methodCall("getPublishedTopics", [callerId, subgraph]);
  }

  getTopicTypes(callerId: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("getTopicTypes", [callerId]);
  }

  getSystemState(callerId: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("getSystemState", [callerId]);
  }

  getUri(callerId: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("getUri", [callerId]);
  }

  lookupService(callerId: string, service: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("lookupService", [callerId, service]);
  }
}
