// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TcpAddress, TcpSocket } from "@foxglove/ros1";
import EventEmitter from "eventemitter3";
import net from "net";

import { TcpMessageStream } from "./TcpMessageStream";

type MaybeHasFd = {
  _handle?: {
    fd?: number;
  };
};

export class TcpSocketNode extends EventEmitter implements TcpSocket {
  #socket: net.Socket;
  #transformer = new TcpMessageStream();

  constructor(socket: net.Socket) {
    super();
    this.#socket = socket;
    this.#socket.pipe(this.#transformer);

    socket.on("close", () => this.emit("close"));
    socket.on("end", () => this.emit("end"));
    socket.on("timeout", () => this.emit("timeout"));
    socket.on("error", (err) => this.emit("error", err));

    this.#transformer.on("message", (data: Uint8Array) => this.emit("message", data));
  }

  remoteAddress(): TcpAddress | undefined {
    if (this.#socket.destroyed) {
      return undefined;
    }

    const port = this.#socket.remotePort;
    const family = this.#socket.remoteFamily;
    const address = this.#socket.remoteAddress;
    return port !== undefined && family !== undefined && address !== undefined
      ? { port, family, address }
      : undefined;
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
    return !this.#socket.destroyed && this.#socket.remoteAddress !== undefined;
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

  static Connect(options: { host: string; port: number }): Promise<TcpSocket> {
    return new Promise((resolve, reject) => {
      const TIMEOUT_MS = 5000;
      const KEEPALIVE_MS = 60 * 1000;

      const socket: net.Socket = net
        .createConnection(
          {
            timeout: TIMEOUT_MS,
            port: options.port,
            host: options.host,
          },
          () => {
            socket.removeListener("error", reject);
            socket.setKeepAlive(true, KEEPALIVE_MS);
            resolve(new TcpSocketNode(socket));
          },
        )
        .on("error", reject);
    });
  }
}
