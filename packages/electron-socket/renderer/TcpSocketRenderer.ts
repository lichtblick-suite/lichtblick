// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import { Cloneable, RpcCall, RpcEvent, RpcResponse } from "../shared/Rpc";
import { TcpAddress } from "../shared/TcpTypes";

export class TcpSocketRenderer extends EventEmitter {
  #messagePort: MessagePort;
  #callbacks = new Map<number, (result: Cloneable[]) => void>();
  #nextCallId = 0;
  #events = new Map<string, (args: Cloneable[], ports?: readonly MessagePort[]) => void>([
    ["connect", () => this.emit("connect")],
    ["close", () => this.emit("close")],
    ["end", () => this.emit("end")],
    ["timeout", () => this.emit("timeout")],
    ["error", (args) => this.emit("error", new Error(args[0] as string))],
    ["data", (args) => this.emit("data", args[0] as Uint8Array)],
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

  async remoteAddress(): Promise<TcpAddress | undefined> {
    const res = await this.#apiCall("remoteAddress");
    return res[0] as TcpAddress | undefined;
  }

  async localAddress(): Promise<TcpAddress | undefined> {
    const res = await this.#apiCall("localAddress");
    return res[0] as TcpAddress | undefined;
  }

  async fd(): Promise<number | undefined> {
    const res = await this.#apiCall("fd");
    return res[0] as number | undefined;
  }

  async setKeepAlive(enable?: boolean, initialDelay?: number): Promise<void> {
    await this.#apiCall("setKeepAlive", enable, initialDelay);
  }

  async setTimeout(timeout: number): Promise<void> {
    await this.#apiCall("setTimeout", timeout);
  }

  async setNoDelay(noDelay?: boolean): Promise<void> {
    await this.#apiCall("setNoDelay", noDelay);
  }

  async connected(): Promise<boolean> {
    const res = await this.#apiCall("connected");
    return res[0] as boolean;
  }

  async connect(): Promise<void> {
    const res = await this.#apiCall("connect");
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

  async write(data: Uint8Array, transfer = true): Promise<void> {
    return new Promise((resolve) => {
      const callId = this.#nextCallId++;
      this.#callbacks.set(callId, () => {
        this.#callbacks.delete(callId);
        resolve();
      });
      const msg: RpcCall = ["write", callId, data];
      if (transfer) {
        this.#messagePort.postMessage(msg, [data.buffer]);
      } else {
        this.#messagePort.postMessage(msg);
      }
    });
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
