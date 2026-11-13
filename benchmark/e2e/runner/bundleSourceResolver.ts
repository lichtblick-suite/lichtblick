// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Resolves CPU profile call frames of the benchmark renderer to original sources through the
// build's external source maps (`devtool: "source-map"` of both prod benchmark builds), loaded
// from the build output directory in Node. Scripts are matched by file name: the web build serves
// its output directory flat, the Electron shell loads it via `file://`.

import fs from "node:fs";
import path from "node:path";

import type { BundleFileSystem, BundleLayout } from "./bundleSourceResolver.types";
import { BINDING_LOOKBEHIND_CHARS } from "./constants";
import { decodeSourceMap, originalPositionFor } from "./sourceMap";
import type { DecodedSourceMap, OriginalPosition, RawSourceMap } from "./sourceMap.types";
import type {
  CpuProfileCallFrame,
  FrameResolver,
  ResolvedFrame,
} from "../result/directAttribution.types";

const NODE_FILE_SYSTEM: BundleFileSystem = {
  exists: (filePath) => fs.existsSync(filePath),
  readText: (filePath) => fs.readFileSync(filePath, "utf8"),
};

/** `webpack://<namespace>/` prefix of the map `sources`. */
const WEBPACK_SOURCE_PREFIX = /^webpack:\/\/[^/]*\//;

type ScriptEntry =
  | {
      kind: "mapped";
      map: DecodedSourceMap;
      sources: string[];
      sourcesContent: readonly (string | null)[];
      /** Lines of `sourcesContent`, split on first use. */
      sourceLines: Map<number, string[]>;
    }
  | { kind: "unmapped" }
  | { kind: "external" };

/** Binding right before a function start: `readonly #tick = `, `#onFrame = (`, `now: `. */
const BINDING_BEFORE_FUNCTION = /([#\w$]+)\s*(?::\s*[^=:]+)?[=:]\s*(?:async\s*)?\(?\s*$/;

/** Start of a (generic) parameter list after a function name. */
const PARAMETER_LIST_START = /^\s*[(<]/;

/**
 * Original name of the function starting at 0-based `column` of an original source `line`: the
 * map's `mappedName` when it is the identifier at the column (`function recordRenderDone(`,
 * `public isEnabled(`; not a first parameter `(timestamp: number) =>`), else the binding right before the column (V8 starts an arrow function at
 * its parameter list, where the map names the first parameter or nothing:
 * `readonly #tick = (): void =>` → `#tick`), else undefined.
 */
export function functionNameAt(
  line: string,
  column: number,
  mappedName: string | undefined,
): string | undefined {
  if (
    mappedName != undefined &&
    line.startsWith(mappedName, column) &&
    PARAMETER_LIST_START.test(line.slice(column + mappedName.length))
  ) {
    return mappedName;
  }
  return BINDING_BEFORE_FUNCTION.exec(
    line.slice(Math.max(0, column - BINDING_LOOKBEHIND_CHARS), column),
  )?.[1];
}

/**
 * File name of a script URL (`http://host/main.abc.js?x` / `file:///…/main.js` → `main.js`);
 * undefined for an unparsable URL, a malformed percent escape or no file name.
 */
export function scriptFileName(url: string): string | undefined {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return undefined;
  }
  let name: string;
  try {
    name = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1));
  } catch {
    // Malformed percent escape: not a script of the build.
    return undefined;
  }
  return name === "" ? undefined : name;
}

/**
 * Repo-relative, `/`-separated path of a map `sources` entry
 * (`webpack:///../../packages/x.ts` with context `<repo>/benchmark/src` → `packages/x.ts`); the
 * stripped entry as-is when it lies outside the repository.
 */
export function normalizeMapSource(source: string, layout: BundleLayout): string {
  const withoutPrefix = source.replace(WEBPACK_SOURCE_PREFIX, "");
  const queryStart = withoutPrefix.indexOf("?");
  const stripped = queryStart === -1 ? withoutPrefix : withoutPrefix.slice(0, queryStart);
  const absolute = path.resolve(layout.contextDir, stripped);
  const relative = path.relative(layout.repoRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return stripped;
  }
  return relative.split(path.sep).join("/");
}

/** `functionNameAt` of a mapped position; the map's name alone without `sourcesContent`. */
function originalFunctionName(
  script: Extract<ScriptEntry, { kind: "mapped" }>,
  position: OriginalPosition,
): string | undefined {
  let lines = script.sourceLines.get(position.sourceIndex);
  if (lines == undefined) {
    lines = script.sourcesContent[position.sourceIndex]?.split("\n") ?? [];
    script.sourceLines.set(position.sourceIndex, lines);
  }
  const text = lines[position.line - 1];
  return text == undefined ? position.name : functionNameAt(text, position.column, position.name);
}

/**
 * Frame resolver of a build: a URL whose file has an `.map` in `buildDir` maps through it
 * (`unmapped` with the map's sources when the position has no mapping, without them when the map is
 * unreadable; the name from the
 * original line, `functionNameAt`), a file of `buildDir` without a map is `unmapped`, any other
 * URL is `external`. Maps are decoded once per file.
 */
export function createBundleSourceResolver(
  layout: BundleLayout,
  fileSystem: BundleFileSystem = NODE_FILE_SYSTEM,
): FrameResolver {
  const scripts = new Map<string, ScriptEntry>();

  const loadScript = (fileName: string): ScriptEntry => {
    const scriptPath = path.join(layout.buildDir, fileName);
    const mapPath = `${scriptPath}.map`;
    if (!fileSystem.exists(mapPath)) {
      return fileSystem.exists(scriptPath) ? { kind: "unmapped" } : { kind: "external" };
    }
    try {
      const raw = JSON.parse(fileSystem.readText(mapPath)) as RawSourceMap;
      const map = decodeSourceMap(raw);
      const sources = map.sources.map((source) => normalizeMapSource(source, layout));
      return {
        kind: "mapped",
        map,
        sources,
        sourcesContent: raw.sourcesContent ?? [],
        sourceLines: new Map(),
      };
    } catch (error) {
      console.warn(`Unreadable source map ${mapPath}: ${String(error)}`);
      return { kind: "unmapped" };
    }
  };

  return (frame: CpuProfileCallFrame): ResolvedFrame => {
    const fileName = scriptFileName(frame.url);
    if (fileName == undefined) {
      return { kind: "external" };
    }
    let script = scripts.get(fileName);
    if (script == undefined) {
      script = loadScript(fileName);
      scripts.set(fileName, script);
    }
    if (script.kind !== "mapped") {
      return { kind: script.kind };
    }
    const position = originalPositionFor(script.map, frame.lineNumber, frame.columnNumber);
    if (position == undefined) {
      return { kind: "unmapped", scriptSources: script.sources };
    }
    const name = originalFunctionName(script, position);
    return {
      kind: "mapped",
      source: script.sources[position.sourceIndex] ?? position.source,
      line: position.line,
      ...(name != undefined && { name }),
    };
  };
}
