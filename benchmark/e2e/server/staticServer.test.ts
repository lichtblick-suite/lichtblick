// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { parseRangeHeader, resolveSafePath, startStaticServer } from "./staticServer";
import type { StaticServer } from "./types";

/** Raw request without client-side URL normalization (needed for traversal attempts). */
async function rawGet(origin: string, rawPath: string): Promise<number> {
  const url = new URL(origin);
  return await new Promise<number>((resolve, reject) => {
    const req = http.request(
      { host: url.hostname, port: url.port, path: rawPath, method: "GET" },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("parseRangeHeader", () => {
  it.each([
    ["bytes=0-9", 100, { start: 0, end: 9 }],
    ["bytes=90-", 100, { start: 90, end: 99 }],
    ["bytes=-10", 100, { start: 90, end: 99 }],
    ["bytes=95-200", 100, { start: 95, end: 99 }],
    ["bytes=-500", 100, { start: 0, end: 99 }],
  ])("should parse %s for size %d", (header, size, expected) => {
    // Given / When
    const range = parseRangeHeader(header, size);

    // Then
    expect(range).toEqual(expected);
  });

  it.each([
    ["bytes=100-", 100],
    ["bytes=10-5", 100],
    ["bytes=-0", 100],
  ])("should report %s as unsatisfiable for size %d", (header, size) => {
    // Given / When / Then
    expect(parseRangeHeader(header, size)).toBe("unsatisfiable");
  });

  it.each([
    undefined,
    "items=0-1",
    "bytes=0-1,5-6",
    "bytes=-",
  ])("should ignore absent or unsupported header %s", (header) => {
    // Given / When / Then
    expect(parseRangeHeader(header, 100)).toBeUndefined();
  });
});

describe("resolveSafePath", () => {
  it("should resolve paths inside the root and reject traversal", () => {
    // Given
    const root = path.resolve("/srv/root");

    // When / Then
    expect(resolveSafePath(root, "a/b.txt")).toBe(path.join(root, "a", "b.txt"));
    expect(resolveSafePath(root, "")).toBe(root);
    expect(resolveSafePath(root, "../secret")).toBeUndefined();
    expect(resolveSafePath(root, "a/../../secret")).toBeUndefined();
    expect(resolveSafePath(root, "a\0b")).toBeUndefined();
  });
});

describe("startStaticServer", () => {
  let tmpDir: string;
  let appDir: string;
  let fixturesDir: string;
  let server: StaticServer;
  const binary = Uint8Array.from({ length: 256 }, (_unused, i) => i);

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "benchmark-static-server-"));
    appDir = path.join(tmpDir, "app");
    fixturesDir = path.join(tmpDir, "fixtures");
    fs.mkdirSync(appDir);
    fs.mkdirSync(fixturesDir);
    fs.writeFileSync(path.join(appDir, "index.html"), "<html>index</html>");
    fs.writeFileSync(path.join(appDir, "main.js"), "console.debug(1);");
    fs.writeFileSync(path.join(fixturesDir, "a.mcap"), binary);
    fs.writeFileSync(path.join(tmpDir, "secret.txt"), "secret");
    server = await startStaticServer({ routes: { "/": appDir, "/fixtures/": fixturesDir } });
  });

  afterAll(async () => {
    await server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should listen on 127.0.0.1 with a dynamic port", () => {
    // Given / When / Then
    expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("should serve files with content type and isolation/CORS headers", async () => {
    // Given / When
    const response = await fetch(`${server.origin}/main.js`);

    // Then
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("console.debug(1);");
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.get("cross-origin-embedder-policy")).toBe("credentialless");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-expose-headers")).toContain("Content-Range");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });

  it("should serve the fixture route with the full length", async () => {
    // Given / When
    const response = await fetch(`${server.origin}/fixtures/a.mcap`);

    // Then
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-length")).toBe("256");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(binary);
  });

  it("should answer a Range request with 206 and Content-Range", async () => {
    // Given / When
    const response = await fetch(`${server.origin}/fixtures/a.mcap`, {
      headers: { Range: "bytes=10-19" },
    });

    // Then
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 10-19/256");
    expect(response.headers.get("content-length")).toBe("10");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(binary.slice(10, 20));
  });

  it("should answer an unsatisfiable Range with 416", async () => {
    // Given / When
    const response = await fetch(`${server.origin}/fixtures/a.mcap`, {
      headers: { Range: "bytes=1000-" },
    });

    // Then
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */256");
  });

  it("should answer HEAD with headers only", async () => {
    // Given / When
    const response = await fetch(`${server.origin}/fixtures/a.mcap`, { method: "HEAD" });

    // Then
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("256");
    expect(await response.text()).toBe("");
  });

  it("should answer CORS preflight allowing the Range header", async () => {
    // Given / When
    const response = await fetch(`${server.origin}/fixtures/a.mcap`, {
      method: "OPTIONS",
      headers: { "Access-Control-Request-Headers": "range" },
    });

    // Then
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("Range");
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("should fall back to index.html for extension-less paths of the root route only", async () => {
    // Given / When
    const spa = await fetch(`${server.origin}/some/route`);
    const missingAsset = await fetch(`${server.origin}/missing.js`);
    const missingFixture = await fetch(`${server.origin}/fixtures/missing`);

    // Then
    expect(spa.status).toBe(200);
    expect(await spa.text()).toBe("<html>index</html>");
    expect(missingAsset.status).toBe(404);
    expect(missingFixture.status).toBe(404);
  });

  it("should reject path traversal", async () => {
    // Given / When
    const status = await rawGet(server.origin, "/fixtures/..%2f..%2fsecret.txt");

    // Then
    expect(status).toBe(403);
  });

  it("should reject unsupported methods", async () => {
    // Given / When
    const response = await fetch(`${server.origin}/main.js`, { method: "POST", body: "x" });

    // Then
    expect(response.status).toBe(405);
  });
});
