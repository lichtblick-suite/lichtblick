// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import { IIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

import {
  sourceOverlapsRange,
  filterSourcesByTimeRange,
  filterSourcesForBackfill,
} from "./sourceTimeOverlap";

function makeSource(start?: Time, end?: Time): IIterableSource {
  return {
    sourceType: "deserialized",
    initialize: jest.fn(),
    messageIterator: jest.fn(),
    getBackfillMessages: jest.fn(),
    getStart: start ? () => start : undefined,
    getEnd: end ? () => end : undefined,
  } as unknown as IIterableSource;
}

describe("sourceOverlapsRange", () => {
  it("returns true when no query range is specified", () => {
    const source = makeSource({ sec: 10, nsec: 0 }, { sec: 20, nsec: 0 });
    expect(sourceOverlapsRange(source, undefined, undefined)).toBe(true);
  });

  it("returns true when source has no time info", () => {
    const source = makeSource(undefined, undefined);
    expect(sourceOverlapsRange(source, { sec: 0, nsec: 0 }, { sec: 100, nsec: 0 })).toBe(true);
  });

  it("returns true when ranges overlap", () => {
    const source = makeSource({ sec: 10, nsec: 0 }, { sec: 30, nsec: 0 });
    expect(sourceOverlapsRange(source, { sec: 20, nsec: 0 }, { sec: 40, nsec: 0 })).toBe(true);
  });

  it("returns true when source is fully contained in query", () => {
    const source = makeSource({ sec: 15, nsec: 0 }, { sec: 25, nsec: 0 });
    expect(sourceOverlapsRange(source, { sec: 10, nsec: 0 }, { sec: 30, nsec: 0 })).toBe(true);
  });

  it("returns true when query is fully contained in source", () => {
    const source = makeSource({ sec: 0, nsec: 0 }, { sec: 100, nsec: 0 });
    expect(sourceOverlapsRange(source, { sec: 10, nsec: 0 }, { sec: 20, nsec: 0 })).toBe(true);
  });

  it("returns false when source is entirely before query", () => {
    const source = makeSource({ sec: 0, nsec: 0 }, { sec: 5, nsec: 0 });
    expect(sourceOverlapsRange(source, { sec: 10, nsec: 0 }, { sec: 20, nsec: 0 })).toBe(false);
  });

  it("returns false when source is entirely after query", () => {
    const source = makeSource({ sec: 30, nsec: 0 }, { sec: 40, nsec: 0 });
    expect(sourceOverlapsRange(source, { sec: 10, nsec: 0 }, { sec: 20, nsec: 0 })).toBe(false);
  });

  it("returns true when ranges touch at boundary", () => {
    const source = makeSource({ sec: 20, nsec: 0 }, { sec: 30, nsec: 0 });
    expect(sourceOverlapsRange(source, { sec: 10, nsec: 0 }, { sec: 20, nsec: 0 })).toBe(true);
  });
});

describe("filterSourcesByTimeRange", () => {
  it("returns all sources when no range is specified", () => {
    const sources = [
      makeSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 }),
      makeSource({ sec: 20, nsec: 0 }, { sec: 30, nsec: 0 }),
    ];
    expect(filterSourcesByTimeRange(sources)).toHaveLength(2);
  });

  it("filters out sources outside the requested range", () => {
    const source1 = makeSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 });
    const source2 = makeSource({ sec: 20, nsec: 0 }, { sec: 30, nsec: 0 });
    const source3 = makeSource({ sec: 40, nsec: 0 }, { sec: 50, nsec: 0 });
    const result = filterSourcesByTimeRange(
      [source1, source2, source3],
      { sec: 15, nsec: 0 },
      { sec: 35, nsec: 0 },
    );
    expect(result).toEqual([source2]);
  });

  it("includes sources without time info", () => {
    const source1 = makeSource(undefined, undefined);
    const source2 = makeSource({ sec: 50, nsec: 0 }, { sec: 60, nsec: 0 });
    const result = filterSourcesByTimeRange(
      [source1, source2],
      { sec: 0, nsec: 0 },
      { sec: 10, nsec: 0 },
    );
    expect(result).toEqual([source1]);
  });
});

describe("filterSourcesForBackfill", () => {
  it("includes sources that start at or before the backfill time", () => {
    const source1 = makeSource({ sec: 0, nsec: 0 }, { sec: 10, nsec: 0 });
    const source2 = makeSource({ sec: 15, nsec: 0 }, { sec: 25, nsec: 0 });
    const source3 = makeSource({ sec: 30, nsec: 0 }, { sec: 40, nsec: 0 });
    const result = filterSourcesForBackfill([source1, source2, source3], { sec: 20, nsec: 0 });
    expect(result).toEqual([source1, source2]);
  });

  it("excludes sources that start after the backfill time", () => {
    const source1 = makeSource({ sec: 50, nsec: 0 }, { sec: 60, nsec: 0 });
    const result = filterSourcesForBackfill([source1], { sec: 10, nsec: 0 });
    expect(result).toEqual([]);
  });

  it("includes sources without start time info", () => {
    const source = makeSource(undefined, undefined);
    const result = filterSourcesForBackfill([source], { sec: 10, nsec: 0 });
    expect(result).toEqual([source]);
  });
});
