// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import net from "net";

import { Cloneable, RpcCall, RpcHandler, RpcResponse } from "../shared/Rpc";
import { TcpAddress } from "../shared/TcpTypes";
import { TcpSocketElectron } from "./TcpSocketElectron";
import { nextId, registerEntity } from "./registry";

export class TcpServerElectron {
  readonly id: number;
  private _server: net.Server;
  private _messagePort: MessagePort;
  private _api = new Map<string, RpcHandler>([
    ["address", (callId) => this._apiResponse([callId, this.address()])],
    [
      "listen",
      (callId, args) => {
        const port = args[0] as number | undefined;
        const hostname = args[1] as string | undefined;
        const backlog = args[2] as number | undefined;
        this.listen(port, hostname, backlog)
          .then(() => this._apiResponse([callId, undefined]))
          .catch((err) => this._apiResponse([callId, String(err.stack ?? err)]));
      },
    ],
    ["close", (callId) => this._apiResponse([callId, this.close()])],
    ["dispose", (callId) => this._apiResponse([callId, this.dispose()])],
  ]);

  constructor(id: number, messagePort: MessagePort) {
    this.id = id;
    this._server = net.createServer();
    this._messagePort = messagePort;

    this._server.on("close", () => this._emit("close"));
    this._server.on("connection", (socket) => this._emitConnection(socket));
    this._server.on("error", (err) => this._emit("error", String(err.stack ?? err)));

    messagePort.onmessage = (ev: MessageEvent<RpcCall>) => {
      const [methodName, callId] = ev.data;
      const args = ev.data.slice(2);
      const handler = this._api.get(methodName);
      handler?.(callId, args);
    };
    messagePort.start();
  }

  address(): TcpAddress | undefined {
    const addr = this._server.address();
    if (addr == undefined || typeof addr === "string") {
      // Address will only be a string for an IPC (named pipe) server, which
      // should never happen here
      return undefined;
    }
    return addr;
  }

  listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this._server.listen(port, hostname, backlog, () => {
        this._server.removeListener("error", reject);
        resolve();
      });
    });
  }

  close(): void {
    this._server.close();
  }

  dispose(): void {
    this._server.removeAllListeners();
    this.close();
    this._messagePort.close();
  }

  private _apiResponse(message: RpcResponse, transfer?: Transferable[]): void {
    if (transfer != undefined) {
      this._messagePort.postMessage(message, transfer);
    } else {
      this._messagePort.postMessage(message);
    }
  }

  private _emit(eventName: string, ...args: Cloneable[]): void {
    const msg = [eventName, ...args];
    this._messagePort.postMessage(msg);
  }

  private _emitConnection(socket: net.Socket): void {
    const id = nextId();
    const channel = new MessageChannel();
    const host = socket.remoteAddress as string;
    const port = socket.remotePort as number;
    const electronSocket = new TcpSocketElectron(id, channel.port2, host, port, socket);
    registerEntity(id, electronSocket);
    this._messagePort.postMessage(["connection"], [channel.port1]);
  }
}
