// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type HttpHeaders = Record<string, number | string | string[]>;

export type IncomingHttpHeaders = Record<string, string | string[] | undefined>;

export type HttpRequest = {
  body: string;
  aborted: boolean;
  httpVersion: string;
  httpVersionMajor: number;
  httpVersionMinor: number;
  complete: boolean;
  headers: IncomingHttpHeaders;
  rawHeaders: string[];
  trailers: IncomingHttpHeaders;
  rawTrailers: string[];
  method?: string;
  url?: string;
};

export type HttpResponse = {
  statusCode: number;
  statusMessage?: string;
  headers?: HttpHeaders;
  body?: string;
  chunkedEncoding?: boolean;
  shouldKeepAlive?: boolean;
  useChunkedEncodingByDefault?: boolean;
  sendDate?: boolean;
};

export type HttpHandler = (req: HttpRequest) => Promise<HttpResponse>;
