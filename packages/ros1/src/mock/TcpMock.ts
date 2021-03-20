// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter } from "eventemitter3";

import { TcpAddress, TcpServer, TcpSocket } from "../TcpTypes";

export class TcpSocketMock extends EventEmitter implements TcpSocket {
  #connected = true;

  constructor() {
    super();
  }

  remoteAddress(): TcpAddress | undefined {
    return { address: "192.168.1.2", port: 40000, family: this.#connected ? "IPv4" : undefined };
  }

  localAddress(): TcpAddress | undefined {
    return this.#connected ? { address: "127.0.0.1", port: 30000, family: "IPv4" } : undefined;
  }

  fd(): number | undefined {
    return 1;
  }

  connected(): boolean {
    return this.#connected;
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {
    this.#connected = false;
  }

  write(_data: Uint8Array): Promise<void> {
    return Promise.resolve();
  }
}

export class TcpServerMock extends EventEmitter implements TcpServer {
  listening = true;

  constructor() {
    super();
  }

  address(): TcpAddress | undefined {
    return this.listening ? { address: "192.168.1.1", port: 20000, family: "IPv4" } : undefined;
  }

  close(): void {
    this.listening = false;
  }
}

export function TcpListen(_options: {
  host?: string;
  port?: number;
  backlog?: number;
}): Promise<TcpServerMock> {
  return Promise.resolve(new TcpServerMock());
}

export function TcpSocketConnect(_options: { host: string; port: number }): Promise<TcpSocket> {
  return Promise.resolve(new TcpSocketMock());
}
