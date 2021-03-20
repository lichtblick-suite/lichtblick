// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import net from "net";

import { TcpAddress, TcpSocket } from "@foxglove/ros1";

import { TcpMessageStream } from "./TcpMessageStream";

type MaybeHasFd = {
  _handle?: {
    fd?: number;
  };
};

export class TcpSocketNode extends EventEmitter implements TcpSocket {
  #host: string;
  #port: number;
  #socket: net.Socket;
  #transformer = new TcpMessageStream();

  constructor(host: string, port: number, socket: net.Socket) {
    super();
    this.#host = host;
    this.#port = port;
    this.#socket = socket;
    this.#socket.pipe(this.#transformer);

    socket.on("connect", () => this.emit("connect"));
    socket.on("close", () => this.emit("close"));
    socket.on("end", () => this.emit("end"));
    socket.on("timeout", () => this.emit("timeout"));
    socket.on("error", (err) => this.emit("error", err));

    this.#transformer.on("message", (data: Uint8Array) => this.emit("message", data));
  }

  remoteAddress(): TcpAddress | undefined {
    return {
      port: this.#port,
      family: this.#socket.remoteFamily,
      address: this.#host,
    };
  }

  localAddress(): TcpAddress | undefined {
    if (this.#socket.destroyed) {
      return undefined;
    }
    const port = this.#socket.localPort;
    const family = this.#socket.remoteFamily; // There is no localFamily
    const address = this.#socket.localAddress;
    return port !== undefined && family !== undefined && address !== undefined
      ? { port, family, address }
      : undefined;
  }

  fd(): number | undefined {
    // There is no public node.js API for retrieving the file descriptor for a
    // socket. This is the only way of retrieving it from pure JS, on platforms
    // where sockets have file descriptors. See
    // <https://github.com/nodejs/help/issues/1312>
    // eslint-disable-next-line no-underscore-dangle
    return ((this.#socket as unknown) as MaybeHasFd)._handle?.fd;
  }

  connected(): boolean {
    return !this.#socket.destroyed && this.#socket.localAddress !== undefined;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const KEEPALIVE_MS = 60 * 1000;

      this.#socket.on("error", reject).connect(this.#port, this.#host, () => {
        this.#socket.removeListener("error", reject);
        this.#socket.setKeepAlive(true, KEEPALIVE_MS);
        resolve();
      });
    });
  }

  close(): void {
    this.#socket.destroy();
  }

  write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#socket.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  static Create({ host, port }: { host: string; port: number }): Promise<TcpSocket> {
    return Promise.resolve(new TcpSocketNode(host, port, new net.Socket()));
  }
}
