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
  #server: net.Server;
  #messagePort: MessagePort;
  #api = new Map<string, RpcHandler>([
    ["address", (callId) => this.#apiResponse([callId, this.address()])],
    [
      "listen",
      (callId, args) => {
        const port = args[0] as number | undefined;
        const hostname = args[1] as string | undefined;
        const backlog = args[2] as number | undefined;
        this.listen(port, hostname, backlog)
          .then(() => this.#apiResponse([callId, undefined]))
          .catch((err) => this.#apiResponse([callId, String(err.stack ?? err)]));
      },
    ],
    ["close", (callId) => this.#apiResponse([callId, this.close()])],
    ["dispose", (callId) => this.#apiResponse([callId, this.dispose()])],
  ]);

  constructor(id: number, messagePort: MessagePort) {
    this.id = id;
    this.#server = net.createServer();
    this.#messagePort = messagePort;

    this.#server.on("close", () => this.#emit("close"));
    this.#server.on("connection", (socket) => this.#emitConnection(socket));
    this.#server.on("error", (err) => this.#emit("error", String(err.stack ?? err)));

    messagePort.onmessage = (ev: MessageEvent<RpcCall>) => {
      const [methodName, callId] = ev.data;
      const args = ev.data.slice(2);
      const handler = this.#api.get(methodName);
      handler?.(callId, args);
    };
    messagePort.start();
  }

  address(): TcpAddress | undefined {
    const addr = this.#server.address();
    if (addr == undefined || typeof addr === "string") {
      // Address will only be a string for an IPC (named pipe) server, which
      // should never happen here
      return undefined;
    }
    return addr;
  }

  listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server.listen(port, hostname, backlog, () => {
        this.#server.removeListener("error", reject);
        resolve();
      });
    });
  }

  close(): void {
    this.#server.close();
  }

  dispose(): void {
    this.#server.removeAllListeners();
    this.close();
    this.#messagePort.close();
  }

  #apiResponse = (message: RpcResponse, transfer?: Transferable[]): void => {
    if (transfer != undefined) {
      this.#messagePort.postMessage(message, transfer);
    } else {
      this.#messagePort.postMessage(message);
    }
  };

  #emit = (eventName: string, ...args: Cloneable[]): void => {
    const msg = [eventName, ...args];
    this.#messagePort.postMessage(msg);
  };

  #emitConnection = (socket: net.Socket): void => {
    const id = nextId();
    const channel = new MessageChannel();
    const host = socket.remoteAddress as string;
    const port = socket.remotePort as number;
    const electronSocket = new TcpSocketElectron(id, channel.port2, host, port, socket);
    registerEntity(id, electronSocket);
    this.#messagePort.postMessage(["connection"], [channel.port1]);
  };
}
