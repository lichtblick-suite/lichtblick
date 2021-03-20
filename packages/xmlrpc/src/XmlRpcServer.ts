// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TextEncoder } from "web-encoding";

import { Deserializer } from "./Deserializer";
import { HttpRequest, HttpResponse, HttpServer } from "./HttpTypes";
import { serializeFault, serializeMethodResponse } from "./Serializer";
import { XmlRpcFault } from "./XmlRpcFault";
import { XmlRpcMethodHandler } from "./XmlRpcTypes";

// Create an XML-RPC server with a user-supplied HTTP(S) implementation
export class XmlRpcServer {
  readonly server: HttpServer;
  xmlRpcHandlers = new Map<string, XmlRpcMethodHandler>();

  constructor(server: HttpServer) {
    this.server = server;
    server.handler = this.#requestHandler; // Our HTTP handler
  }

  url(): string | undefined {
    return this.server.url();
  }

  listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    return this.server.listen(port, hostname, backlog);
  }

  close(): void {
    this.server.close();
  }

  setHandler(methodName: string, handler: XmlRpcMethodHandler): void {
    this.xmlRpcHandlers.set(methodName, handler);
  }

  #requestHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    const deserializer = new Deserializer();
    const [methodName, args] = await deserializer.deserializeMethodCall(req.body);
    const handler = this.xmlRpcHandlers.get(methodName);
    if (handler != undefined) {
      let body: string | undefined;
      try {
        body = serializeMethodResponse(await handler(methodName, args));
      } catch (err) {
        body = serializeFault(
          err instanceof XmlRpcFault ? err : new XmlRpcFault(String(err.stack ?? err)),
        );
      }
      const contentLength = String(new TextEncoder().encode(body).length);
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/xml", "Content-Length": contentLength, body },
      };
    } else {
      return { statusCode: 404 };
    }
  };
}
