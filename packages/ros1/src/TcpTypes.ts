// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type TcpAddress = {
  port: number;
  family: string;
  address: string;
};

export interface TcpSocket {
  remoteAddress(): TcpAddress | undefined;
  localAddress(): TcpAddress | undefined;
  fd(): number | undefined;
  connected(): boolean;
  close(): void;
  write(data: Uint8Array): Promise<void>;

  on(eventName: "close", listener: () => void): this;
  on(eventName: "message", listener: (message: Uint8Array) => void): this;
  on(eventName: "end", listener: () => void): this;
  on(eventName: "timeout", listener: () => void): this;
  on(eventName: "error", listener: (err: Error) => void): this;
}

export interface TcpServer {
  address(): TcpAddress | undefined;
  close(): void;

  on(eventName: "close", listener: () => void): this;
  on(eventName: "connection", listener: (socket: TcpSocket) => void): this;
  on(eventName: "error", listener: (err: Error) => void): this;
}

export interface TcpListen {
  (options: { host?: string; port?: number; backlog?: number }): Promise<TcpServer>;
}

export interface TcpConnect {
  (options: { host: string; port: number }): Promise<TcpSocket>;
}
