// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import { URL } from "whatwg-url";

export type HttpAddress = {
  hostname: string;
  port: number;
  secure: boolean;
};

export type XmlRpcValue = string | number | boolean | XmlRpcValue[];

// [code, msg, value]
export type XmlRpcResponse = [number, string, XmlRpcValue];

export interface XmlRpcClient {
  readonly serverUrl: URL;

  methodCall(method: string, args: XmlRpcValue[]): Promise<XmlRpcResponse>;
}

export interface XmlRpcServer extends EventEmitter {
  address(): HttpAddress | undefined;
  close(): void;

  addMethod(method: string, handler: (args: XmlRpcValue[]) => Promise<XmlRpcResponse>): this;

  on(eventName: "close", listener: () => void): this;
  on(eventName: "error", listener: (err: Error) => void): this;
}

export interface XmlRpcCreateClient {
  (options: { url: URL }): Promise<XmlRpcClient>;
}

export interface XmlRpcCreateServer {
  (options: { hostname: string; port?: number }): Promise<XmlRpcServer>;
}
