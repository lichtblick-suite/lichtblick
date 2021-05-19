// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter } from "eventemitter3";

import { TcpAddress, TcpServer, TcpServerEvents, TcpSocket, TcpSocketEvents } from "../TcpTypes";

export class MockTcpSocket extends EventEmitter<TcpSocketEvents> implements TcpSocket {
  private _connected = true;

  constructor() {
    super();
  }

  remoteAddress(): Promise<TcpAddress | undefined> {
    return Promise.resolve({
      address: "192.168.1.2",
      port: 40000,
      family: this._connected ? "IPv4" : undefined,
    });
  }

  localAddress(): Promise<TcpAddress | undefined> {
    return Promise.resolve(
      this._connected ? { address: "127.0.0.1", port: 30000, family: "IPv4" } : undefined,
    );
  }

  fd(): Promise<number | undefined> {
    return Promise.resolve(1);
  }

  connected(): Promise<boolean> {
    return Promise.resolve(this._connected);
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    this._connected = false;
    return Promise.resolve();
  }

  write(_data: Uint8Array): Promise<void> {
    return Promise.resolve();
  }

  setNoDelay(_noDelay?: boolean): Promise<void> {
    return Promise.resolve();
  }
}

export class MockTcpServer extends EventEmitter<TcpServerEvents> implements TcpServer {
  listening = true;

  constructor() {
    super();
  }

  address(): Promise<TcpAddress | undefined> {
    return Promise.resolve(
      this.listening ? { address: "192.168.1.1", port: 20000, family: "IPv4" } : undefined,
    );
  }

  close(): void {
    this.listening = false;
  }
}

export function TcpListen(_options: {
  host?: string;
  port?: number;
  backlog?: number;
}): Promise<MockTcpServer> {
  return Promise.resolve(new MockTcpServer());
}

export function TcpSocketConnect(_options: { host: string; port: number }): Promise<TcpSocket> {
  return Promise.resolve(new MockTcpSocket());
}
