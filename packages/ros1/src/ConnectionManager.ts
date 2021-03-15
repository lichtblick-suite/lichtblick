// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TcpConnection } from "./TcpConnection";
import { TcpAddress, TcpServer } from "./TcpTypes";

export class ConnectionManager {
  #connectionIdCounter = 0;
  #tcpServer?: TcpServer;
  #tcpConnections: TcpConnection[] = [];

  constructor(options: { tcpServer?: TcpServer }) {
    this.#tcpServer = options.tcpServer;
  }

  close(): void {
    this.#tcpServer?.close();
    this.#tcpConnections.forEach((conn) => conn.close());
    this.#tcpConnections = [];
  }

  newConnectionId(): number {
    return this.#connectionIdCounter++;
  }

  addTcpConnection(connection: TcpConnection): boolean {
    const idx = this.#tcpConnections.indexOf(connection);
    if (idx > -1) {
      return false;
    }
    this.#tcpConnections.push(connection);
    return true;
  }

  removeTcpConnection(connection: TcpConnection): boolean {
    const idx = this.#tcpConnections.indexOf(connection);
    if (idx > -1) {
      this.#tcpConnections.splice(idx, 1);
      return true;
    }
    return false;
  }

  tcpServerAddress(): TcpAddress | undefined {
    return this.#tcpServer?.address();
  }
}
