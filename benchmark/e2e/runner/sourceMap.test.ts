// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { decodeSourceMap, originalPositionFor } from "./sourceMap";

// Mappings of a 2-line bundle from two sources (VLQ fields: generated column, source, original
// line, original column, name; all relative):
// line 0: "AAAA" [0, s0, 0, 0], "KCCEA" [5, s1, 1, 2, name 0]
// line 1: "ICCEC" [4, s2, 2, 4, name 1] (relative to the previous segment: source +1, line +1, …)
const RAW = {
  version: 3,
  sources: ["a.ts", "b.ts", "c.ts"],
  names: ["record", "drain"],
  mappings: "AAAA,KCCEA;ICCEC",
};

describe("decodeSourceMap", () => {
  it("should decode relative VLQ segments per generated line", () => {
    // Given / When
    const map = decodeSourceMap(RAW);

    // Then
    expect(map.lines).toHaveLength(2);
    expect(Array.from(map.lines[0]!)).toEqual([0, 0, 0, 0, -1, 5, 1, 1, 2, 0]);
    expect(Array.from(map.lines[1]!)).toEqual([4, 2, 2, 4, 1]);
  });

  it("should prefix the sources with the source root", () => {
    // Given
    const raw = { ...RAW, sourceRoot: "webpack:///" };

    // When
    const map = decodeSourceMap(raw);

    // Then
    expect(map.sources[0]).toBe("webpack:///a.ts");
  });

  it("should reject other versions and invalid characters", () => {
    // Given / When / Then
    expect(() => decodeSourceMap({ ...RAW, version: 2 })).toThrow("version 2");
    expect(() => decodeSourceMap({ ...RAW, mappings: "AA!A" })).toThrow("VLQ character");
  });

  it("should decode multi-digit and negative values", () => {
    // Given column 16 ("gB"), then source 0, line 1000 ("w+B"), column −1 ("D")
    const raw = { version: 3, sources: ["a.ts"], mappings: "gBAw+BD" };

    // When
    const map = decodeSourceMap(raw);

    // Then
    expect(Array.from(map.lines[0]!)).toEqual([16, 0, 1000, -1, -1]);
  });
});

describe("originalPositionFor", () => {
  it("should map a column to the closest segment at or before it", () => {
    // Given
    const map = decodeSourceMap(RAW);

    // When / Then: 1-based original line, 0-based column, name when present
    expect(originalPositionFor(map, 0, 3)).toEqual({
      source: "a.ts",
      sourceIndex: 0,
      line: 1,
      column: 0,
    });
    expect(originalPositionFor(map, 0, 5)).toEqual({
      source: "b.ts",
      sourceIndex: 1,
      line: 2,
      column: 2,
      name: "record",
    });
    expect(originalPositionFor(map, 1, 100)).toMatchObject({ source: "c.ts", name: "drain" });
  });

  it("should return undefined before the first segment of a line or on an unknown line", () => {
    // Given
    const map = decodeSourceMap(RAW);

    // When / Then
    expect(originalPositionFor(map, 1, 3)).toBeUndefined();
    expect(originalPositionFor(map, 5, 0)).toBeUndefined();
  });

  it("should return undefined for a segment without a source", () => {
    // Given a 1-field segment (generated column only)
    const map = decodeSourceMap({ version: 3, sources: ["a.ts"], mappings: "C" });

    // When / Then
    expect(originalPositionFor(map, 0, 4)).toBeUndefined();
  });

  it("should sort unsorted segments of a line by column", () => {
    // Given segments at columns 10 then 2 ("U" = +10, "R" = −8)
    const map = decodeSourceMap({ version: 3, sources: ["a.ts", "b.ts"], mappings: "UAAA,RCAA" });

    // When / Then
    expect(originalPositionFor(map, 0, 5)).toMatchObject({ source: "b.ts" });
    expect(originalPositionFor(map, 0, 12)).toMatchObject({ source: "a.ts" });
  });
});
