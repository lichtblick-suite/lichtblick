// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import http from "http";

import { HttpHandler, HttpServer } from "@foxglove/xmlrpc";

export class HttpServerNodejs implements HttpServer {
  handler: HttpHandler;
  #server: http.Server;

  constructor() {
    this.handler = () => Promise.resolve({ statusCode: 404 });
    this.#server = new http.Server((req, res) => {
      // Read the full request body into a string
      const chunks: Uint8Array[] = [];
      req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        const input = { ...req, body };

        // Handle this request
        this.handler(input).then((out) => {
          // Write the HTTP response
          res.shouldKeepAlive = out.shouldKeepAlive ?? res.shouldKeepAlive;
          res.writeHead(out.statusCode, out.statusMessage, out.headers);
          res.end(out.body);
        });
      });
    });
  }

  url(): string | undefined {
    const addr = this.#server.address();
    if (addr == undefined || typeof addr === "string") {
      return addr ?? undefined;
    }
    const hostname = addr.address === "::" ? "[::]" : addr;
    return `http://${hostname}${addr.port != undefined ? ":" + String(addr.port) : ""}/`;
  }

  listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server.on("error", reject);
      this.#server.listen(port, hostname, backlog, () => {
        this.#server.removeListener("error", reject);
        resolve();
      });
    });
  }

  close(): void {
    this.#server.close();
  }
}
