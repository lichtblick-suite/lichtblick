// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { XmlRpcClient, XmlRpcFault, XmlRpcValue } from "@foxglove/xmlrpc";

import { RosXmlRpcResponse, RosXmlRpcResponseOrFault } from "./XmlRpcTypes";

export class RosXmlRpcClient {
  private _client: XmlRpcClient;

  constructor(url: string) {
    this._client = new XmlRpcClient(url, { encoding: "utf8" });
  }

  url(): string {
    return this._client.url;
  }

  protected _methodCall = async (
    methodName: string,
    args: XmlRpcValue[],
  ): Promise<RosXmlRpcResponse> => {
    const res = await this._client.methodCall(methodName, args);
    if (!Array.isArray(res) || res.length !== 3) {
      throw new Error(`malformed XML-RPC response`);
    }

    const [code, msg] = res;
    if (typeof code !== "number" || typeof msg !== "string") {
      throw new Error(`invalid code/msg, code="${code}", msg="${msg}"`);
    }
    return res as RosXmlRpcResponse;
  };

  protected _multiMethodCall = async (
    requests: { methodName: string; params: XmlRpcValue[] }[],
  ): Promise<RosXmlRpcResponseOrFault[]> => {
    const res = await this._client.multiMethodCall(requests);

    const output: RosXmlRpcResponseOrFault[] = [];
    for (const entry of res) {
      if (entry instanceof XmlRpcFault) {
        output.push(entry);
      } else if (!Array.isArray(entry) || entry.length !== 3) {
        throw new Error(`malformed XML-RPC multicall response`);
      } else {
        const [code, msg] = entry;
        if (typeof code !== "number" || typeof msg !== "string") {
          throw new Error(`invalid code/msg, code="${code}", msg="${msg}"`);
        }
        output.push(entry as RosXmlRpcResponse);
      }
    }
    return output;
  };
}
