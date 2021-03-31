// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import http from "http";

import { HttpRequest, HttpResponse } from "../shared/HttpTypes";
import { Cloneable, RpcCall, RpcHandler, RpcResponse } from "../shared/Rpc";
import { TcpAddress } from "../shared/TcpTypes";

export class HttpServerElectron {
  readonly id: number;
  private _server: http.Server;
  private _messagePort: MessagePort;
  private _nextRequestId = 0;
  private _requests = new Map<number, (response: HttpResponse) => Promise<void>>();
  private _api = new Map<string, RpcHandler>([
    ["address", (callId) => this._apiResponse([callId, this.address()])],
    [
      "listen",
      (callId, args) => {
        const port = args[0] as number | undefined;
        const hostname = args[1] as string | undefined;
        const backlog = args[2] as number | undefined;
        this.listen(port, hostname, backlog)
          .then(() => this._apiResponse([callId, undefined]))
          .catch((err) => this._apiResponse([callId, String(err.stack ?? err)]));
      },
    ],
    [
      "response",
      (callId, args) => {
        const requestId = args[0] as number;
        const response = args[1] as HttpResponse;
        const handler = this._requests.get(requestId);
        if (handler == undefined) {
          this._apiResponse([callId, `unknown requestId ${requestId}`]);
          return;
        }
        this._requests.delete(requestId);
        handler(response)
          .then(() => this._apiResponse([callId, undefined]))
          .catch((err) => this._apiResponse([callId, String(err.stack ?? err)]));
      },
    ],
    ["close", (callId) => this._apiResponse([callId, this.close()])],
    ["dispose", (callId) => this._apiResponse([callId, this.dispose()])],
  ]);

  constructor(id: number, messagePort: MessagePort) {
    this.id = id;
    this._server = http.createServer(this._handleRequest);
    this._messagePort = messagePort;

    this._server.on("close", () => this._emit("close"));
    this._server.on("error", (err) => this._emit("error", String(err.stack ?? err)));

    messagePort.onmessage = (ev: MessageEvent<RpcCall>) => {
      const [methodName, callId] = ev.data;
      const args = ev.data.slice(2);
      const handler = this._api.get(methodName);
      handler?.(callId, args);
    };
    messagePort.start();
  }

  address(): TcpAddress | undefined {
    const addr = this._server.address();
    if (addr == undefined || typeof addr === "string") {
      // Address will only be a string for an IPC (named pipe) server, which
      // should never happen here
      return undefined;
    }
    return addr;
  }

  listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this._server.listen(port, hostname, backlog, () => {
        this._server.removeListener("error", reject);
        resolve();
      });
    });
  }

  close(): void {
    this._server.close();
  }

  dispose(): void {
    this._server.removeAllListeners();
    this.close();
    this._messagePort.close();
  }

  private _apiResponse(message: RpcResponse, transfer?: Transferable[]): void {
    if (transfer != undefined) {
      this._messagePort.postMessage(message, transfer);
    } else {
      this._messagePort.postMessage(message);
    }
  }

  private _emit(eventName: string, ...args: Cloneable[]): void {
    const msg = [eventName, ...args];
    this._messagePort.postMessage(msg);
  }

  private _handleRequest = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();

      const requestId = this._nextRequestId++;
      this._requests.set(
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
      this._emit("request", requestId, request);
    });
  };
}
