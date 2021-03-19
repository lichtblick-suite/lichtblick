// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fetch } from "cross-fetch";
import { TextEncoder } from "web-encoding";

import { Deserializer } from "./Deserializer";
import { serializeMethodCall } from "./Serializer";
import { Encoding, XmlRpcValue } from "./XmlRpcTypes";

// A client for making XML-RPC method calls over HTTP(S)
export class XmlRpcClient {
  url: string;
  encoding?: Encoding;
  headers = {
    "User-Agent": "Foxglove XML-RPC",
    "Content-Type": "text/xml",
    "Content-Length": "0",
    Accept: "text/xml",
    "Accept-Charset": "UTF8",
    Connection: "Keep-Alive",
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
    const headers = { ...this.headers };
    headers["Content-Length"] = String(new TextEncoder().encode(body).length);

    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body,
    });

    const resText = await res.text();
    const deserializer = new Deserializer(this.encoding);
    return deserializer.deserializeMethodResponse(resText);
  }
}
