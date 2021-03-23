// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import { HttpHandler, HttpRequest, HttpResponse } from "../shared/HttpTypes";
import { Cloneable, RpcCall, RpcEvent, RpcResponse } from "../shared/Rpc";
import { TcpAddress } from "../shared/TcpTypes";

export class HttpServerRenderer extends EventEmitter {
  handler: HttpHandler;

  #url: string | undefined;
  #messagePort: MessagePort;
  #callbacks = new Map<number, (result: Cloneable[]) => void>();
  #nextCallId = 0;
  #events = new Map<string, (args: Cloneable[], ports?: readonly MessagePort[]) => void>([
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
        this.#apiCall("response", requestId, res);
      },
    ],
    ["error", (args) => this.emit("error", new Error(args[0] as string))],
  ]);

  constructor(messagePort: MessagePort, requestHandler?: HttpHandler) {
    super();
    this.#messagePort = messagePort;
    this.handler = requestHandler ?? (() => Promise.resolve({ statusCode: 404 }));

    messagePort.onmessage = (ev: MessageEvent<RpcResponse | RpcEvent>) => {
      const args = ev.data.slice(1);
      if (typeof ev.data[0] === "number") {
        // RpcResponse
        const callId = ev.data[0];
        const callback = this.#callbacks.get(callId);
        if (callback !== undefined) {
          this.#callbacks.delete(callId);
          callback(args);
        }
      } else {
        // RpcEvent
        const eventName = ev.data[0];
        const handler = this.#events.get(eventName);
        handler?.(args, ev.ports);
      }
    };
    messagePort.start();
  }

  url(): string | undefined {
    return this.#url;
  }

  async address(): Promise<TcpAddress | undefined> {
    const res = await this.#apiCall("address");
    return res[0] as TcpAddress | undefined;
  }

  async listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    const res = await this.#apiCall("listen", port, hostname, backlog);
    const err = res[0] as string | undefined;
    if (err != undefined) {
      return Promise.reject(new Error(err));
    }

    // Store the URL we are listening at
    const addr = await this.address();
    if (addr == undefined || typeof addr === "string") {
      this.#url = addr;
    } else {
      this.#url = `http://${hostname ?? addr.address}:${addr.port}/`;
    }
  }

  async close(): Promise<void> {
    await this.#apiCall("close");
  }

  async dispose(): Promise<void> {
    await this.#apiCall("dispose");
    // eslint-disable-next-line no-restricted-syntax
    this.#messagePort.onmessage = null;
    this.#messagePort.close();
    this.#callbacks.clear();
  }

  #apiCall = (methodName: string, ...args: Cloneable[]): Promise<Cloneable[]> => {
    return new Promise((resolve) => {
      const callId = this.#nextCallId++;
      this.#callbacks.set(callId, (result) => {
        this.#callbacks.delete(callId);
        resolve(result);
      });
      const msg: RpcCall = [methodName, callId, ...args];
      this.#messagePort.postMessage(msg);
    });
  };
}
