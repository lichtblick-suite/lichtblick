// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import net from "net";

import { TcpAddress, TcpServer, TcpServerEvents } from "../TcpTypes";
import { TcpSocketNode } from "./TcpSocketNode";

export class TcpServerNode extends EventEmitter<TcpServerEvents> implements TcpServer {
  private _server: net.Server;

  constructor(server: net.Server) {
    super();
    this._server = server;

    server.on("close", () => this.emit("close"));
    server.on("connection", (socket) => {
      const host = socket.remoteAddress;
      const port = socket.remotePort;
      if (host != undefined && port != undefined) {
        this.emit("connection", new TcpSocketNode(host, port, socket));
      }
    });
    server.on("error", (err) => this.emit("error", err));
  }

  async address(): Promise<TcpAddress | undefined> {
    const addr = this._server.address();
    if (addr == undefined || typeof addr === "string") {
      // Address will only be a string for an IPC (named pipe) server, which
      // should never happen in TcpServerNode
      return undefined;
    }
    return addr;
  }

  close(): void {
    this._server.close();
  }

  static async Listen(options: {
    host?: string;
    port?: number;
    backlog?: number;
  }): Promise<TcpServer> {
    return await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on("error", reject);
      server.listen(options.port, options.host, options.backlog, () => {
        server.removeListener("error", reject);
        resolve(new TcpServerNode(server));
      });
    });
  }
}
