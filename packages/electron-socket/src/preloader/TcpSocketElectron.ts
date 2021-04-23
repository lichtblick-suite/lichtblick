// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import net from "net";

import { Cloneable, RpcCall, RpcHandler, RpcResponse } from "../shared/Rpc";
import { TcpAddress } from "../shared/TcpTypes";
import { dnsLookup } from "./dns";

type MaybeHasFd = {
  _handle?: {
    fd?: number;
  };
};

export class TcpSocketElectron {
  readonly id: number;
  readonly host: string;
  readonly port: number;
  private _socket: net.Socket;
  private _messagePort: MessagePort;
  private _api = new Map<string, RpcHandler>([
    ["remoteAddress", (callId) => this._apiResponse(callId, this.remoteAddress())],
    ["localAddress", (callId) => this._apiResponse(callId, this.localAddress())],
    ["fd", (callId) => this._apiResponse(callId, this.fd())],
    [
      "setKeepAlive",
      (callId, args) => {
        const enable = args[0] as boolean | undefined;
        const initialDelay = args[1] as number | undefined;
        this.setKeepAlive(enable, initialDelay);
        this._apiResponse(callId);
      },
    ],
    [
      "setTimeout",
      (callId, args) => {
        const timeout = args[0] as number;
        this.setTimeout(timeout);
        this._apiResponse(callId);
      },
    ],
    [
      "setNoDelay",
      (callId, args) => {
        const noDelay = args[0] as boolean | undefined;
        this.setNoDelay(noDelay);
        this._apiResponse(callId);
      },
    ],
    ["connected", (callId) => this._apiResponse(callId, this.connected())],
    [
      "connect",
      (callId, _) => {
        this.connect()
          .then(() => this._apiResponse(callId, undefined))
          .catch((err) => this._apiResponse(callId, String(err.stack ?? err)));
      },
    ],
    ["close", (callId) => this._apiResponse(callId, this.close())],
    ["dispose", (callId) => this._apiResponse(callId, this.dispose())],
    [
      "write",
      (callId, args) => {
        const data = args[0] as Uint8Array;
        this.write(data)
          .then(() => this._apiResponse(callId, undefined))
          .catch((err) => this._apiResponse(callId, String(err.stack ?? err)));
      },
    ],
  ]);

  constructor(
    id: number,
    messagePort: MessagePort,
    host: string,
    port: number,
    socket: net.Socket,
  ) {
    this.id = id;
    this.host = host;
    this.port = port;
    this._socket = socket;
    this._messagePort = messagePort;

    this._socket.on("close", () => this._emit("close"));
    this._socket.on("end", () => this._emit("end"));
    this._socket.on("data", this._handleData);
    this._socket.on("timeout", () => this._emit("timeout"));
    this._socket.on("error", (err) => this._emit("error", String(err.stack ?? err)));

    messagePort.onmessage = (ev: MessageEvent<RpcCall>) => {
      const [methodName, callId] = ev.data;
      const args = ev.data.slice(2);
      const handler = this._api.get(methodName);
      handler?.(callId, args);
    };
    messagePort.start();
  }

  remoteAddress(): TcpAddress | undefined {
    const port = this._socket.remotePort;
    const family = this._socket.remoteFamily;
    const address = this._socket.remoteAddress;
    return port !== undefined && address !== undefined ? { port, family, address } : undefined;
  }

  localAddress(): TcpAddress | undefined {
    const port = this._socket.localPort;
    const family = this._socket.remoteFamily; // There is no localFamily
    const address = this._socket.localAddress;
    return port !== undefined && address !== undefined ? { port, family, address } : undefined;
  }

  fd(): number | undefined {
    // There is no public node.js API for retrieving the file descriptor for a
    // socket. This is the only way of retrieving it from pure JS, on platforms
    // where sockets have file descriptors. See
    // <https://github.com/nodejs/help/issues/1312>
    // eslint-disable-next-line no-underscore-dangle
    return ((this._socket as unknown) as MaybeHasFd)._handle?.fd;
  }

  setKeepAlive(enable?: boolean, initialDelay?: number): this {
    this._socket.setKeepAlive(enable, initialDelay);
    return this;
  }

  setTimeout(timeout: number): this {
    this._socket.setTimeout(timeout);
    return this;
  }

  setNoDelay(noDelay?: boolean): this {
    this._socket.setNoDelay(noDelay);
    return this;
  }

  connected(): boolean {
    return !this._socket.destroyed && this._socket.localAddress !== undefined;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket
        .connect({ host: this.host, port: this.port, lookup: dnsLookup }, () => {
          this._socket.removeListener("error", reject);
          resolve();
          this._emit("connect");
        })
        .on("error", reject);
    });
  }

  close(): void {
    this._socket.destroy();
  }

  dispose(): void {
    this._socket.removeAllListeners();
    this.close();
    this._messagePort.close();
  }

  write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private _apiResponse(callId: number, ...args: Cloneable[]): void {
    const msg: RpcResponse = [callId, ...args];
    this._messagePort.postMessage(msg);
  }

  private _emit(eventName: string, ...args: Cloneable[]): void {
    const msg: Cloneable[] = [eventName, ...args];
    this._messagePort.postMessage(msg);
  }

  private _handleData = (data: Uint8Array): void => {
    const msg: Cloneable[] = ["data", data];
    this._messagePort.postMessage(msg, [data.buffer]);
  };
}
