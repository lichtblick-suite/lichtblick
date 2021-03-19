// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import http from "http";

import { HttpRequest, HttpResponse } from "../shared/HttpTypes";
import { Cloneable, RpcCall, RpcHandler, RpcResponse } from "../shared/Rpc";
import { TcpAddress } from "../shared/TcpTypes";

export class HttpServerElectron {
  readonly id: number;
  #server: http.Server;
  #messagePort: MessagePort;
  #nextRequestId = 0;
  #requests = new Map<number, (response: HttpResponse) => Promise<void>>();
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
    [
      "response",
      (callId, args) => {
        const requestId = args[0] as number;
        const response = args[1] as HttpResponse;
        const handler = this.#requests.get(requestId);
        if (handler == undefined) {
          this.#apiResponse([callId, `unknown requestId ${requestId}`]);
          return;
        }
        this.#requests.delete(requestId);
        handler(response)
          .then(() => this.#apiResponse([callId, undefined]))
          .catch((err) => this.#apiResponse([callId, String(err.stack ?? err)]));
      },
    ],
    ["close", (callId) => this.#apiResponse([callId, this.close()])],
    ["dispose", (callId) => this.#apiResponse([callId, this.dispose()])],
  ]);

  constructor(id: number, messagePort: MessagePort) {
    this.id = id;
    this.#server = http.createServer(this.#handleRequest);
    this.#messagePort = messagePort;

    this.#server.on("close", () => this.#emit("close"));
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

  #handleRequest = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();

      const requestId = this.#nextRequestId++;
      this.#requests.set(
        requestId,
        (incomingRes): Promise<void> => {
          res.chunkedEncoding = incomingRes.chunkedEncoding ?? res.chunkedEncoding;
          res.shouldKeepAlive = incomingRes.shouldKeepAlive ?? res.shouldKeepAlive;
          res.useChunkedEncodingByDefault =
            incomingRes.useChunkedEncodingByDefault ?? res.useChunkedEncodingByDefault;
          res.sendDate = incomingRes.sendDate ?? res.sendDate;

          res.writeHead(incomingRes.statusCode, incomingRes.statusMessage, incomingRes.headers);
          return new Promise((resolve) => res.end(incomingRes.body, resolve));
        },
      );

      const request: HttpRequest = {
        body,
        aborted: req.aborted,
        httpVersion: req.httpVersion,
        httpVersionMajor: req.httpVersionMajor,
        httpVersionMinor: req.httpVersionMinor,
        complete: req.complete,
        headers: req.headers,
        rawHeaders: req.rawHeaders,
        trailers: req.trailers,
        rawTrailers: req.rawTrailers,
        method: req.method,
        url: req.url,
      };
      this.#emit("request", requestId, request);
    });
  };
}
