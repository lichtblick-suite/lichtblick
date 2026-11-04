// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Minimal source map v3 decoder (base64 VLQ `mappings`) for the direct CPU attribution: maps a
// generated position of a bundle script to its original source, line and name. Pure (no Node
// imports); the files are read by `runner/bundleSourceResolver.ts`.

import type { DecodedSourceMap, OriginalPosition, RawSourceMap } from "./sourceMap.types";

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Base64 char code → 6-bit value, −1 for any other char. */
const BASE64_VALUES = (() => {
  const values = new Int8Array(128).fill(-1);
  for (let index = 0; index < BASE64_CHARS.length; index++) {
    values[BASE64_CHARS.charCodeAt(index)] = index;
  }
  return values;
})();
const VLQ_CONTINUATION_BIT = 0b10_0000;
const VLQ_VALUE_MASK = 0b01_1111;
const VLQ_SHIFT = 5;
/** Fields per decoded segment (see `DecodedSourceMap.lines`). */
const SEGMENT_FIELDS = 5;
const COMMA = ",".charCodeAt(0);
const SEMICOLON = ";".charCodeAt(0);

/**
 * Decodes `raw.mappings` into per-line segment arrays. Throws on a version other than 3 or an
 * invalid VLQ character.
 */
export function decodeSourceMap(raw: RawSourceMap): DecodedSourceMap {
  if (raw.version !== 3) {
    throw new Error(`Unsupported source map version ${raw.version}`);
  }
  const { mappings } = raw;
  const lines: Int32Array[] = [];
  let line: number[] = [];
  // Relative fields: the column resets per line, the others carry across lines.
  const state = [0, 0, 0, 0, 0];
  const segment: number[] = [];
  let index = 0;

  const pushSegment = () => {
    if (segment.length === 0) {
      return;
    }
    state[0]! += segment[0]!;
    line.push(state[0]!);
    if (segment.length >= 4) {
      for (let field = 1; field < 4; field++) {
        state[field]! += segment[field]!;
        line.push(state[field]!);
      }
      if (segment.length >= 5) {
        state[4]! += segment[4]!;
        line.push(state[4]!);
      } else {
        line.push(-1);
      }
    } else {
      line.push(-1, 0, 0, -1);
    }
    segment.length = 0;
  };

  while (index <= mappings.length) {
    const code = index < mappings.length ? mappings.charCodeAt(index) : SEMICOLON;
    if (code === SEMICOLON || code === COMMA) {
      pushSegment();
      if (code === SEMICOLON) {
        lines.push(sortedSegments(line));
        line = [];
        state[0] = 0;
      }
      index++;
      continue;
    }
    let value = 0;
    let shift = 0;
    let digit: number;
    do {
      const char = mappings.charCodeAt(index++);
      digit = char < 128 ? BASE64_VALUES[char]! : -1;
      if (digit < 0) {
        throw new Error(`Invalid source map VLQ character at ${index - 1}`);
      }
      value += (digit & VLQ_VALUE_MASK) << shift;
      shift += VLQ_SHIFT;
    } while ((digit & VLQ_CONTINUATION_BIT) !== 0);
    // The lowest bit is the sign.
    segment.push((value & 1) === 1 ? -(value >>> 1) : value >>> 1);
  }
  // `mappings` ending with ";" adds a last empty line, as the generated file does.
  const sourceRoot = raw.sourceRoot ?? "";
  return {
    sources: raw.sources.map((source) => `${sourceRoot}${source}`),
    names: raw.names ?? [],
    lines,
  };
}

/** The line's segments as an `Int32Array`, sorted by generated column (stable). */
function sortedSegments(flat: readonly number[]): Int32Array {
  const count = flat.length / SEGMENT_FIELDS;
  let sorted = true;
  for (let index = 1; index < count && sorted; index++) {
    sorted = flat[index * SEGMENT_FIELDS]! >= flat[(index - 1) * SEGMENT_FIELDS]!;
  }
  if (sorted) {
    return Int32Array.from(flat);
  }
  // Stable: equal columns keep their order.
  const order = Array.from({ length: count }, (_, index) => index).sort((a, b) => {
    const byColumn = flat[a * SEGMENT_FIELDS]! - flat[b * SEGMENT_FIELDS]!;
    return byColumn !== 0 ? byColumn : a - b;
  });
  const out = new Int32Array(flat.length);
  order.forEach((from, to) => {
    for (let field = 0; field < SEGMENT_FIELDS; field++) {
      out[to * SEGMENT_FIELDS + field] = flat[from * SEGMENT_FIELDS + field]!;
    }
  });
  return out;
}

/**
 * Original position of the generated 0-based `line` / `column`: the segment of that line with the
 * greatest column ≤ `column` (never one of an earlier line). Undefined without such a segment or
 * when it has no source.
 */
export function originalPositionFor(
  map: DecodedSourceMap,
  line: number,
  column: number,
): OriginalPosition | undefined {
  const segments = map.lines[line];
  if (segments == undefined || segments.length === 0) {
    return undefined;
  }
  let low = 0;
  let high = segments.length / SEGMENT_FIELDS - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (segments[mid * SEGMENT_FIELDS]! <= column) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (found < 0) {
    return undefined;
  }
  const base = found * SEGMENT_FIELDS;
  const sourceIndex = segments[base + 1]!;
  const source = map.sources[sourceIndex];
  if (sourceIndex < 0 || source == undefined) {
    return undefined;
  }
  const nameIndex = segments[base + 4]!;
  const name = nameIndex >= 0 ? map.names[nameIndex] : undefined;
  return {
    source,
    sourceIndex,
    line: segments[base + 2]! + 1,
    column: segments[base + 3]!,
    ...(name != undefined && { name }),
  };
}
