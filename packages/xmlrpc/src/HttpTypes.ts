// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type HttpRequest = {
  body: string;
  method?: string;
  url?: string;
};

export type HttpResponse = {
  statusCode: number;
  statusMessage?: string;
  headers?: Record<string, string>;
  body?: string;
  shouldKeepAlive?: boolean;
};

export type HttpHandler = (req: HttpRequest) => Promise<HttpResponse>;

export interface HttpServer {
  handler: HttpHandler;

  url(): string | undefined;

  listen(port?: number, hostname?: string, backlog?: number): Promise<void>;

  close(): void;
}
