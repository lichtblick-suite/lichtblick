// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type TcpAddress = {
  port: number;
  family?: string;
  address: string;
};

export interface NetworkInterface {
  name: string;
  family: "IPv4" | "IPv6";
  internal: boolean;
  address: string;
  cidr?: string;
  mac: string;
  netmask: string;
}

export interface TcpSocket {
  remoteAddress(): Promise<TcpAddress | undefined>;
  localAddress(): Promise<TcpAddress | undefined>;
  fd(): Promise<number | undefined>;
  connected(): Promise<boolean>;

  connect(): Promise<void>;
  close(): Promise<void>;
  write(data: Uint8Array): Promise<void>;

  on(eventName: "connect", listener: () => void): this;
  on(eventName: "close", listener: () => void): this;
  on(eventName: "data", listener: (data: Uint8Array) => void): this;
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

export interface TcpSocketCreate {
  (options: { host: string; port: number }): Promise<TcpSocket>;
}
