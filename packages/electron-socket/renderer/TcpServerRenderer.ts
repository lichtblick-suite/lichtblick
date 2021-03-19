// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import { Cloneable, RpcCall, RpcEvent, RpcResponse } from "../shared/Rpc";
import { TcpAddress } from "../shared/TcpTypes";
import { TcpSocketRenderer } from "./TcpSocketRenderer";

export class TcpServerRenderer extends EventEmitter {
  #messagePort: MessagePort;
  #callbacks = new Map<number, (result: Cloneable[]) => void>();
  #nextCallId = 0;
  #events = new Map<string, (args: Cloneable[], ports?: readonly MessagePort[]) => void>([
    ["close", () => this.emit("close")],
    [
      "connection",
      (_, ports) => {
        const port = ports?.[0];
        if (port) {
          const socket = new TcpSocketRenderer(port);
          this.emit("connection", socket);
        }
      },
    ],
    ["error", (args) => this.emit("error", new Error(args[0] as string))],
  ]);

  constructor(messagePort: MessagePort) {
    super();
    this.#messagePort = messagePort;

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

  async address(): Promise<TcpAddress | undefined> {
    const res = await this.#apiCall("address");
    return res[0] as TcpAddress | undefined;
  }

  async listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    const res = await this.#apiCall("listen", port, hostname, backlog);
    if (res[0] != undefined) {
      return Promise.reject(new Error(res[0] as string));
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
