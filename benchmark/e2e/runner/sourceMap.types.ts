// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Types of the source map v3 decoder (`runner/sourceMap.ts`).

/** The fields of a source map v3 file the decoder reads (no index maps / `sections`). */
export type RawSourceMap = {
  version: number;
  sources: string[];
  names?: string[];
  mappings: string;
  sourceRoot?: string;
  /** Original source texts by `sources` index (read by `runner/bundleSourceResolver.ts`). */
  sourcesContent?: (string | null)[];
};

/**
 * A decoded source map: per generated line (0-based), its segments as flat 5-tuples
 * `[generatedColumn, sourceIndex, originalLine, originalColumn, nameIndex]` sorted by column
 * (`sourceIndex` / `nameIndex` −1 when absent; original line and column 0-based).
 */
export type DecodedSourceMap = {
  sources: string[];
  names: string[];
  lines: Int32Array[];
};

/** Original position of a generated position (`originalPositionFor`). */
export type OriginalPosition = {
  /** `sourceRoot` + the `sources` entry, as written in the map. */
  source: string;
  /** Index of `source` in `DecodedSourceMap.sources`. */
  sourceIndex: number;
  /** 1-based. */
  line: number;
  /** 0-based. */
  column: number;
  name?: string;
};
