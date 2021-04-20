// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import fetch from "@foxglove/just-fetch";

import { Deserializer } from "./Deserializer";
import { serializeMethodCall } from "./Serializer";
import { XmlRpcFault } from "./XmlRpcFault";
import { Encoding, XmlRpcStruct, XmlRpcValue, XmlRpcValueOrFault } from "./XmlRpcTypes";

// A client for making XML-RPC method calls over HTTP(S)
export class XmlRpcClient {
  url: string;
  encoding?: Encoding;
  headers = {
    "Content-Type": "text/xml",
    Accept: "text/xml",
  };

  constructor(url: string, options?: { encoding?: Encoding; headers?: Record<string, string> }) {
    this.url = url;
    this.encoding = options?.encoding;
    if (options?.headers != undefined) {
      this.headers = { ...this.headers, ...options.headers };
    }
  }

  // Make an XML-RPC call to the server and return the response
  async methodCall(method: string, params?: XmlRpcValue[]): Promise<XmlRpcValue> {
    const body = serializeMethodCall(method, params, this.encoding);
    const headers = this.headers;

    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body,
    });

    const resText = await res.text();
    const deserializer = new Deserializer(this.encoding);
    return deserializer.deserializeMethodResponse(resText);
  }

  async multiMethodCall(
    requests: { methodName: string; params: XmlRpcValue[] }[],
  ): Promise<XmlRpcValueOrFault[]> {
    const res = await this.methodCall("system.multicall", [requests]);
    if (!Array.isArray(res) || res.length !== requests.length) {
      throw new Error(`malformed system.multicall response`);
    }

    const output: XmlRpcValueOrFault[] = [];

    const createFault = (fault?: XmlRpcStruct) => {
      fault = fault ?? {};
      const faultString = typeof fault.faultString === "string" ? fault.faultString : undefined;
      const faultCode = typeof fault.faultCode === "number" ? fault.faultCode : undefined;
      return new XmlRpcFault(faultString, faultCode);
    };

    for (const entry of res) {
      if (!Array.isArray(entry) || entry.length !== 1) {
        output.push(createFault(entry as XmlRpcStruct));
      } else {
        output.push(entry[0]);
      }
    }

    return output;
  }
}
