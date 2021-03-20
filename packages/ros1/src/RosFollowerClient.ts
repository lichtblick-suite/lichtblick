// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { XmlRpcValue } from "@foxglove/xmlrpc";

import { RosXmlRpcClient } from "./RosXmlRpcClient";
import { RosXmlRpcResponse } from "./XmlRpcTypes";

export type ProtocolParams = [string, ...XmlRpcValue[]];

export class RosFollowerClient extends RosXmlRpcClient {
  getBusStats(callerId: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("getBusStats", [callerId]);
  }

  getBusInfo(callerId: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("getBusInfo", [callerId]);
  }

  shutdown(callerId: string, msg = ""): Promise<RosXmlRpcResponse> {
    return this._methodCall("shutdown", [callerId, msg]);
  }

  async getPid(callerId: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("getPid", [callerId]);
  }

  getSubscriptions(callerId: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("getSubscriptions", [callerId]);
  }

  getPublications(callerId: string): Promise<RosXmlRpcResponse> {
    return this._methodCall("getPublications", [callerId]);
  }

  paramUpdate(
    callerId: string,
    parameterKey: string,
    parameterValue: XmlRpcValue,
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("paramUpdate", [callerId, parameterKey, parameterValue]);
  }

  publisherUpdate(
    callerId: string,
    topic: string,
    publishers: string[],
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("publisherUpdate", [callerId, topic, publishers]);
  }

  requestTopic(
    callerId: string,
    topic: string,
    protocols: ProtocolParams[],
  ): Promise<RosXmlRpcResponse> {
    return this._methodCall("requestTopic", [callerId, topic, protocols]);
  }
}
