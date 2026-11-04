// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { CONTENT_TYPES, FORBIDDEN, STATIC_SERVER_COMMON_HEADERS } from "./constants";
import type { Route } from "./staticServer.types";
import type { ByteRange, StaticServer, StaticServerOptions } from "./types";

// Minimal static file server for the benchmark runner (Node `http` only, no dependencies).
//
// - `routes` maps URL prefixes to directories (longest prefix wins). The "/" route additionally
//   falls back to its `index.html` for unknown extension-less paths (SPA routing).
// - Supports GET/HEAD with single `Range` requests (206 / 416) and OPTIONS preflight.
// - Every response is cross-origin isolation friendly (COOP same-origin + COEP credentialless, so
//   the web page gets `crossOriginIsolated === true` and `measureUserAgentSpecificMemory`), carries
//   `Cross-Origin-Resource-Policy: cross-origin` and permissive CORS headers so fixtures can also be
//   fetched from other origins (e.g. the Electron shell's `file://` page).

export function getContentType(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Parses a `Range` header for a resource of `size` bytes.
 *
 * @returns the inclusive byte range, `"unsatisfiable"` (respond 416), or undefined when the header
 * is absent, malformed or a multi-range request (all served as a full 200 response, which RFC 9110
 * allows).
 */
export function parseRangeHeader(
  header: string | undefined,
  size: number,
): ByteRange | "unsatisfiable" | undefined {
  if (header == undefined) {
    return undefined;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match == undefined) {
    return undefined;
  }
  const [, rawStart = "", rawEnd = ""] = match;
  if (rawStart === "" && rawEnd === "") {
    return undefined;
  }
  if (rawStart === "") {
    // Suffix range: last N bytes.
    const suffixLength = Number(rawEnd);
    if (suffixLength === 0 || size === 0) {
      return "unsatisfiable";
    }
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }
  const start = Number(rawStart);
  if (start >= size) {
    return "unsatisfiable";
  }
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) {
    return "unsatisfiable";
  }
  return { start, end };
}

function normalizeRoutes(routes: Readonly<Record<string, string>>): Route[] {
  const result: Route[] = [];
  for (const [prefix, dir] of Object.entries(routes)) {
    if (!prefix.startsWith("/") || !prefix.endsWith("/")) {
      throw new Error(`Route prefix must start and end with "/": ${prefix}`);
    }
    result.push({ prefix, dir: path.resolve(dir), spaFallback: prefix === "/" });
  }
  // Longest prefix first.
  result.sort((a, b) => b.prefix.length - a.prefix.length);
  return result;
}

/**
 * Resolves `relativeUrlPath` (already URL-decoded, without the route prefix) inside `dir`.
 * Returns undefined when the result would escape `dir` (path traversal) or contains a NUL byte.
 */
export function resolveSafePath(dir: string, relativeUrlPath: string): string | undefined {
  if (relativeUrlPath.includes("\0")) {
    return undefined;
  }
  const root = path.resolve(dir);
  const resolved = path.resolve(root, `./${relativeUrlPath}`);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return undefined;
  }
  return resolved;
}

function writeHead(
  res: http.ServerResponse,
  status: number,
  headers: Record<string, string | number> = {},
): void {
  res.writeHead(status, { ...STATIC_SERVER_COMMON_HEADERS, ...headers });
}

function sendText(
  res: http.ServerResponse,
  status: number,
  text: string,
  { isHead }: { isHead: boolean },
): void {
  writeHead(res, status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(isHead ? undefined : text);
}

function statFile(filePath: string): fs.Stats | undefined {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() ? stats : undefined;
  } catch {
    return undefined;
  }
}

/** Finds the file to serve for a URL path: a path, `FORBIDDEN` (traversal) or undefined (404). */
function findFile(
  routes: readonly Route[],
  urlPath: string,
): string | typeof FORBIDDEN | undefined {
  const route = routes.find((candidate) => urlPath.startsWith(candidate.prefix));
  if (route == undefined) {
    return undefined;
  }
  const relative = urlPath.slice(route.prefix.length);
  const resolved = resolveSafePath(route.dir, relative);
  if (resolved == undefined) {
    return FORBIDDEN;
  }
  if (statFile(resolved) != undefined) {
    return resolved;
  }
  const index = path.join(resolved, "index.html");
  if (statFile(index) != undefined) {
    return index;
  }
  // SPA fallback only for extension-less paths, so missing assets still 404.
  if (route.spaFallback && path.extname(relative) === "") {
    const rootIndex = path.join(route.dir, "index.html");
    return statFile(rootIndex) != undefined ? rootIndex : undefined;
  }
  return undefined;
}

function serveFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  filePath: string,
  stats: fs.Stats,
): void {
  const isHead = req.method === "HEAD";
  const size = stats.size;
  const baseHeaders = {
    "Content-Type": getContentType(filePath),
    "Last-Modified": stats.mtime.toUTCString(),
  };
  const range = parseRangeHeader(req.headers.range, size);
  if (range === "unsatisfiable") {
    writeHead(res, 416, {
      ...baseHeaders,
      "Content-Range": `bytes */${size}`,
      "Content-Length": 0,
    });
    res.end();
    return;
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const length = size === 0 ? 0 : end - start + 1;
  if (range != undefined) {
    writeHead(res, 206, {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": length,
    });
  } else {
    writeHead(res, 200, { ...baseHeaders, "Content-Length": size });
  }
  if (isHead || length === 0) {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath, { start, end });
  // Clients routinely abort (e.g. `BrowserHttpReader.open()` cancels a full GET after the headers).
  res.on("close", () => {
    stream.destroy();
  });
  stream.on("error", () => {
    res.destroy();
  });
  stream.pipe(res);
}

function handleRequest(
  routes: readonly Route[],
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  const method = req.method ?? "GET";
  if (method === "OPTIONS") {
    writeHead(res, 204, {
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Cache-Control",
      "Access-Control-Max-Age": 600,
      "Content-Length": 0,
    });
    res.end();
    return;
  }
  const isHead = method === "HEAD";
  if (method !== "GET" && !isHead) {
    writeHead(res, 405, { Allow: "GET, HEAD, OPTIONS", "Content-Length": 0 });
    res.end();
    return;
  }

  let urlPath: string;
  try {
    urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    sendText(res, 400, "Bad request", { isHead });
    return;
  }

  const filePath = findFile(routes, urlPath);
  if (filePath === FORBIDDEN) {
    sendText(res, 403, "Forbidden", { isHead });
    return;
  }
  const stats = filePath != undefined ? statFile(filePath) : undefined;
  if (filePath == undefined || stats == undefined) {
    sendText(res, 404, "Not found", { isHead });
    return;
  }
  serveFile(req, res, filePath, stats);
}

/** Starts the server (default 127.0.0.1, random port). */
export async function startStaticServer(options: StaticServerOptions): Promise<StaticServer> {
  const routes = normalizeRoutes(options.routes);
  const server = http.createServer((req, res) => {
    handleRequest(routes, req, res);
  });
  const host = options.host ?? "127.0.0.1";
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://${host}:${port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}
