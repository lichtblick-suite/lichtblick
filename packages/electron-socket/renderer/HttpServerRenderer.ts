// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import { HttpHandler, HttpRequest, HttpResponse } from "../shared/HttpTypes";
import { Cloneable, RpcCall, RpcEvent, RpcResponse } from "../shared/Rpc";
import { TcpAddress } from "../shared/TcpTypes";

export class HttpServerRenderer extends EventEmitter {
  handler: HttpHandler;

  private _url?: string;
  private _port?: number;
  private _messagePort: MessagePort;
  private _callbacks = new Map<number, (result: Cloneable[]) => void>();
  private _nextCallId = 0;
  private _events = new Map<string, (args: Cloneable[], ports?: readonly MessagePort[]) => void>([
    ["close", () => this.emit("close")],
    [
      "request",
      async (args) => {
        const requestId = args[0] as number;
        const req = args[1] as HttpRequest;
        let res: HttpResponse | undefined;
        try {
          res = await this.handler(req);
        } catch (err) {
          res = { statusCode: 500, statusMessage: String(err) };
        }
        this._apiCall("response", requestId, res);
      },
    ],
    ["error", (args) => this.emit("error", new Error(args[0] as string))],
  ]);

  constructor(messagePort: MessagePort, requestHandler?: HttpHandler) {
    super();
    this._messagePort = messagePort;
    this.handler = requestHandler ?? (() => Promise.resolve({ statusCode: 404 }));

    messagePort.onmessage = (ev: MessageEvent<RpcResponse | RpcEvent>) => {
      const args = ev.data.slice(1);
      if (typeof ev.data[0] === "number") {
        // RpcResponse
        const callId = ev.data[0];
        const callback = this._callbacks.get(callId);
        if (callback !== undefined) {
          this._callbacks.delete(callId);
          callback(args);
        }
      } else {
        // RpcEvent
        const eventName = ev.data[0];
        const handler = this._events.get(eventName);
        handler?.(args, ev.ports);
      }
    };
    messagePort.start();
  }

  url(): string | undefined {
    return this._url;
  }

  port(): number | undefined {
    return this._port;
  }

  async address(): Promise<TcpAddress | undefined> {
    const res = await this._apiCall("address");
    return res[0] as TcpAddress | undefined;
  }

  async listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    const res = await this._apiCall("listen", port, hostname, backlog);
    const err = res[0] as string | undefined;
    if (err != undefined) {
      return Promise.reject(new Error(err));
    }

    // Store the URL and port we are listening at
    const addr = await this.address();
    if (addr == undefined || typeof addr === "string") {
      this._url = addr;
      this._port = undefined;
    } else {
      this._url = `http://${hostname ?? addr.address}:${addr.port}/`;
      this._port = addr.port;
    }
  }

  async close(): Promise<void> {
    await this._apiCall("close");
  }

  async dispose(): Promise<void> {
    await this._apiCall("dispose");
    // eslint-disable-next-line no-restricted-syntax
    this._messagePort.onmessage = null;
    this._messagePort.close();
    this._callbacks.clear();
  }

  _apiCall(methodName: string, ...args: Cloneable[]): Promise<Cloneable[]> {
    return new Promise((resolve) => {
      const callId = this._nextCallId++;
      this._callbacks.set(callId, (result) => {
        this._callbacks.delete(callId);
        resolve(result);
      });
      const msg: RpcCall = [methodName, callId, ...args];
      this._messagePort.postMessage(msg);
    });
  }
}
