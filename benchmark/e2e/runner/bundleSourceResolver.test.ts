// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "node:path";

import {
  createBundleSourceResolver,
  functionNameAt,
  normalizeMapSource,
  scriptFileName,
} from "./bundleSourceResolver";
import type { BundleFileSystem, BundleLayout } from "./bundleSourceResolver.types";

const REPO = path.resolve("/repo");
const LAYOUT: BundleLayout = {
  buildDir: path.join(REPO, "benchmark", ".webpack"),
  contextDir: path.join(REPO, "benchmark", "src"),
  repoRoot: REPO,
};

/** Source map of `main.js`: line 0 column 0 → sink, column 10 → collector (named `onFrame`). */
const MAIN_MAP_SOURCES = [
  "webpack:///../../packages/suite-base/src/util/telemetry/BufferedTelemetrySink.ts",
  "webpack:///./telemetry/collectors/FrameCollector.ts?abc",
];
const MAIN_MAP = JSON.stringify({
  version: 3,
  sources: MAIN_MAP_SOURCES,
  names: ["onFrame"],
  mappings: "AAAA,UCEAA",
});

/**
 * `MAIN_MAP` with `sourcesContent`: line 0 column 10 → line 3 column 19 of the collector, the
 * parameter list of the arrow function bound to `#tick` (named after its parameter `value`).
 */
const MAIN_MAP_WITH_CONTENT = JSON.stringify({
  version: 3,
  sources: MAIN_MAP_SOURCES,
  sourcesContent: [null, "class C {\n\n  readonly #tick = (value: number): void => {};\n}\n"],
  names: ["value"],
  mappings: "AAAA,UCEmBA",
});

/** In-memory files of the build dir; counts the reads. */
function fakeFileSystem(files: Record<string, string>): BundleFileSystem & { reads: () => number } {
  let reads = 0;
  const full = new Map(
    Object.entries(files).map(([name, text]) => [path.join(LAYOUT.buildDir, name), text]),
  );
  return {
    exists: (filePath) => full.has(filePath),
    readText: (filePath) => {
      reads += 1;
      return full.get(filePath)!;
    },
    reads: () => reads,
  };
}

const frame = (url: string, lineNumber = 0, columnNumber = 0) => ({
  functionName: "a",
  url,
  lineNumber,
  columnNumber,
});

describe("scriptFileName", () => {
  it.each([
    { url: "http://127.0.0.1:5000/main.abc.js?x=1#h", expected: "main.abc.js" },
    { url: "file:///Users/me/benchmark/.webpack-desktop/renderer/main.js", expected: "main.js" },
    { url: "http://127.0.0.1:5000/", expected: undefined },
    { url: "not a url", expected: undefined },
  ])("should return $expected for $url", ({ url, expected }) => {
    // Given / When / Then
    expect(scriptFileName(url)).toBe(expected);
  });
});

describe("normalizeMapSource", () => {
  it("should resolve webpack sources against the context to repo-relative posix paths", () => {
    // Given / When / Then
    expect(
      normalizeMapSource("webpack:///../../packages/suite-base/src/util/telemetry/x.ts", LAYOUT),
    ).toBe("packages/suite-base/src/util/telemetry/x.ts");
    expect(normalizeMapSource("webpack://ns/./telemetry/y.ts?abc", LAYOUT)).toBe(
      "benchmark/src/telemetry/y.ts",
    );
  });

  it("should keep a source outside the repository as written", () => {
    // Given / When / Then
    expect(normalizeMapSource("webpack:///../../../../outside.ts", LAYOUT)).toBe(
      "../../../../outside.ts",
    );
  });
});

describe("functionNameAt", () => {
  it.each([
    {
      line: "export function recordRenderDone(",
      column: 16,
      mappedName: "recordRenderDone",
      expected: "recordRenderDone",
    },
    {
      line: "  readonly #tick = (): void => {",
      column: 19,
      mappedName: undefined,
      expected: "#tick",
    },
    {
      line: "  readonly #onFrame = (timestamp: number): void => {",
      column: 23,
      mappedName: "timestamp",
      expected: "#onFrame",
    },
    { line: "    now: () => performance.now(),", column: 9, mappedName: "now", expected: "now" },
    { line: "  public observe(", column: 9, mappedName: undefined, expected: undefined },
    {
      line: "        ? (callback) => raf(callback)",
      column: 11,
      mappedName: "callback",
      expected: undefined,
    },
  ])("should name the function at column $column of $line as $expected", (input) => {
    // Given / When
    const name = functionNameAt(input.line, input.column, input.mappedName);

    // Then
    expect(name).toBe(input.expected);
  });
});

describe("createBundleSourceResolver", () => {
  it("should name an arrow function after its binding in the original source", () => {
    // Given
    const files = fakeFileSystem({ "main.js": "", "main.js.map": MAIN_MAP_WITH_CONTENT });
    const resolve = createBundleSourceResolver(LAYOUT, files);

    // When
    const resolved = resolve(frame("http://host/main.js", 0, 10));

    // Then
    expect(resolved).toEqual({
      kind: "mapped",
      source: "benchmark/src/telemetry/collectors/FrameCollector.ts",
      line: 3,
      name: "#tick",
    });
  });

  it("should map frames of a bundle script through its source map", () => {
    // Given
    const files = fakeFileSystem({ "main.js": "", "main.js.map": MAIN_MAP });
    const resolve = createBundleSourceResolver(LAYOUT, files);

    // When
    const sink = resolve(frame("http://127.0.0.1:5000/main.js", 0, 3));
    const collector = resolve(frame("http://127.0.0.1:5000/main.js", 0, 12));

    // Then
    expect(sink).toEqual({
      kind: "mapped",
      source: "packages/suite-base/src/util/telemetry/BufferedTelemetrySink.ts",
      line: 1,
    });
    expect(collector).toEqual({
      kind: "mapped",
      source: "benchmark/src/telemetry/collectors/FrameCollector.ts",
      line: 3,
      name: "onFrame",
    });
  });

  it("should load each source map once", () => {
    // Given
    const files = fakeFileSystem({ "main.js": "", "main.js.map": MAIN_MAP });
    const resolve = createBundleSourceResolver(LAYOUT, files);

    // When
    resolve(frame("http://host/main.js", 0, 0));
    resolve(frame("http://host/main.js", 0, 10));
    resolve(frame("http://host/main.js", 0, 20));

    // Then
    expect(files.reads()).toBe(1);
  });

  it("should classify unmapped positions, scripts without a map and foreign scripts", () => {
    // Given
    const files = fakeFileSystem({
      "main.js": "",
      "main.js.map": MAIN_MAP,
      "vendor.js": "",
    });
    const resolve = createBundleSourceResolver(LAYOUT, files);

    // When / Then
    expect(resolve(frame("http://host/main.js", 7, 0))).toEqual({
      kind: "unmapped",
      scriptSources: [
        "packages/suite-base/src/util/telemetry/BufferedTelemetrySink.ts",
        "benchmark/src/telemetry/collectors/FrameCollector.ts",
      ],
    });
    expect(resolve(frame("http://host/vendor.js"))).toEqual({ kind: "unmapped" });
    expect(resolve(frame("http://host/playwright-injected.js"))).toEqual({ kind: "external" });
    expect(resolve(frame(""))).toEqual({ kind: "external" });
  });

  it("should treat an unreadable source map as unmapped", () => {
    // Given
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const files = fakeFileSystem({ "main.js": "", "main.js.map": "{not json" });
    const resolve = createBundleSourceResolver(LAYOUT, files);

    // When
    const resolved = resolve(frame("http://host/main.js"));

    // Then
    expect(resolved).toEqual({ kind: "unmapped" });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
