// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TcpAddress, TcpServer } from "@foxglove/ros1";
import EventEmitter from "eventemitter3";
import net from "net";

import { TcpSocketNode } from "./TcpSocketNode";

export class TcpServerNode extends EventEmitter implements TcpServer {
  #server: net.Server;

  constructor(server: net.Server) {
    super();
    this.#server = server;

    server.on("close", () => this.emit("close"));
    server.on("connection", (socket) => this.emit("connection", new TcpSocketNode(socket)));
    server.on("error", (err) => this.emit("error", err));
  }

  address(): TcpAddress | undefined {
    const addr = this.#server.address();
    if (addr == undefined || typeof addr === "string") {
      // Address will only be a string for an IPC (named pipe) server, which
      // should never happen in TcpServerNode
      return undefined;
    }
    return addr;
  }

  close(): void {
    this.#server.close();
  }

  static TcpListen(options: {
    host?: string;
    port?: number;
    backlog?: number;
  }): Promise<TcpServerNode> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on("error", reject);
      server.listen(options.port, options.host, options.backlog, () => {
        server.removeListener("error", reject);
        resolve(new TcpServerNode(server));
      });
    });
  }
}
