// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromSec } from "@foxglove/rostime";
import permutations from "@foxglove/studio-base/test/permutations";

import MessageMemoryCache from "./MessageMemoryCache";

describe("MessageMemoryCache", () => {
  it.each(
    [0, 1, 2, 3, 4].flatMap((leading) => [0, 1, 2, 3, 4].map((trailing) => [leading, trailing])),
  )(
    "disallows empty and overlapping ranges (%s leading and %s trailing ranges)",
    (leadingRanges, trailingRanges) => {
      const cache = new MessageMemoryCache({
        start: { sec: 0, nsec: 0 },
        end: { sec: 5, nsec: 0 },
      });
      cache.insert({ start: { sec: 1, nsec: 0 }, end: { sec: 2, nsec: 0 } }, []);
      // Test with extra ranges at the beginning and end to ensure the binary search algorithm works correctly.
      for (let i = 0; i < leadingRanges; i++) {
        cache.insert({ start: { sec: 0, nsec: i }, end: { sec: 0, nsec: i + 1 } }, []);
      }
      for (let i = 0; i < trailingRanges; i++) {
        cache.insert({ start: { sec: 4, nsec: i }, end: { sec: 4, nsec: i + 1 } }, []);
      }

      expect(() =>
        cache.insert({ start: { sec: 1, nsec: 0 }, end: { sec: 0, nsec: 500_000_000 } }, []),
      ).toThrow("must not be empty");
      expect(() =>
        cache.insert({ start: { sec: 1, nsec: 0 }, end: { sec: 1, nsec: 0 } }, []),
      ).toThrow("must not be empty");

      expect(() =>
        cache.insert({ start: { sec: 1, nsec: 0 }, end: { sec: 1, nsec: 1 } }, []),
      ).toThrow("overlaps an existing range");
      expect(() =>
        cache.insert({ start: { sec: 1, nsec: 0 }, end: { sec: 2, nsec: 0 } }, []),
      ).toThrow("overlaps an existing range");
      expect(() =>
        cache.insert({ start: { sec: 1, nsec: 0 }, end: { sec: 3, nsec: 0 } }, []),
      ).toThrow("overlaps an existing range");
      expect(() =>
        cache.insert({ start: { sec: 1, nsec: 999_999_999 }, end: { sec: 3, nsec: 0 } }, []),
      ).toThrow("overlaps an existing range");

      expect(() =>
        cache.insert({ start: { sec: 2, nsec: 0 }, end: { sec: 3, nsec: 0 } }, []),
      ).not.toThrow();
      expect(() =>
        cache.insert({ start: { sec: 0, nsec: 500_000_000 }, end: { sec: 1, nsec: 0 } }, []),
      ).not.toThrow();
    },
  );

  describe("nextRangeToLoad", () => {
    it("returns undefined at end of cache range", () => {
      const cache = new MessageMemoryCache({ start: fromSec(0), end: fromSec(5) });
      expect(cache.nextRangeToLoad(fromSec(5))).toBeUndefined();
      cache.insert({ start: fromSec(1), end: fromSec(2) }, []);
      expect(cache.nextRangeToLoad(fromSec(5))).toBeUndefined();
    });

    it.each(
      [0, 1, 2, 3, 4].flatMap((leading) => [0, 1, 2, 3, 4].map((trailing) => [leading, trailing])),
    )(
      "returns correct loaded extent (%s leading and %s trailing ranges)",
      (leadingRanges, trailingRanges) => {
        const cache = new MessageMemoryCache({
          start: { sec: 0, nsec: 0 },
          end: { sec: 5, nsec: 0 },
        });
        cache.insert({ start: fromSec(1), end: fromSec(2) }, []);
        cache.insert({ start: fromSec(4), end: { sec: 4, nsec: 1 } }, []);
        // Test with extra ranges at the beginning and end to ensure the binary search algorithm works correctly.
        for (let i = 0; i < leadingRanges; i++) {
          cache.insert({ start: { sec: 0, nsec: i }, end: { sec: 0, nsec: i + 1 } }, []);
        }
        for (let i = 0; i < trailingRanges; i++) {
          cache.insert({ start: { sec: 4, nsec: i + 1 }, end: { sec: 4, nsec: i + 2 } }, []);
        }

        expect(cache.nextRangeToLoad(fromSec(0.5))).toEqual({
          start: fromSec(0.5),
          end: fromSec(1),
        });
        expect(cache.nextRangeToLoad(fromSec(1))).toEqual({ start: fromSec(2), end: fromSec(4) });
        expect(cache.nextRangeToLoad(fromSec(1.5))).toEqual({ start: fromSec(2), end: fromSec(4) });
        expect(cache.nextRangeToLoad(fromSec(2))).toEqual({ start: fromSec(2), end: fromSec(4) });
        expect(cache.nextRangeToLoad(fromSec(2.5))).toEqual({
          start: fromSec(2.5),
          end: fromSec(4),
        });
      },
    );
  });

  it("merges inserted range with previous range", () => {
    const cache = new MessageMemoryCache({ start: fromSec(0), end: fromSec(5) });

    cache.insert({ start: fromSec(1), end: fromSec(2) }, [
      { topic: "", receiveTime: fromSec(1), message: "a" },
    ]);
    cache.insert({ start: fromSec(2), end: fromSec(3) }, [
      { topic: "", receiveTime: fromSec(2), message: "b" },
    ]);

    expect(cache.fullyLoadedRanges()).toEqual([{ start: fromSec(1), end: fromSec(3) }]);
    expect(cache.getMessages({ start: fromSec(1), end: fromSec(3) })).toEqual([
      { topic: "", receiveTime: fromSec(1), message: "a" },
      { topic: "", receiveTime: fromSec(2), message: "b" },
    ]);
  });

  it("merges inserted range with next range", () => {
    const cache = new MessageMemoryCache({ start: fromSec(0), end: fromSec(5) });

    cache.insert({ start: fromSec(2), end: fromSec(3) }, [
      { topic: "", receiveTime: fromSec(2), message: "b" },
    ]);
    cache.insert({ start: fromSec(1), end: fromSec(2) }, [
      { topic: "", receiveTime: fromSec(1), message: "a" },
    ]);

    expect(cache.fullyLoadedRanges()).toEqual([{ start: fromSec(1), end: fromSec(3) }]);
    expect(cache.getMessages({ start: fromSec(1), end: fromSec(3) })).toEqual([
      { topic: "", receiveTime: fromSec(1), message: "a" },
      { topic: "", receiveTime: fromSec(2), message: "b" },
    ]);
  });

  it("merges inserted range with previous and next ranges", () => {
    const cache = new MessageMemoryCache({ start: fromSec(0), end: fromSec(5) });

    cache.insert({ start: fromSec(2), end: fromSec(3) }, [
      { topic: "", receiveTime: fromSec(2), message: "c" },
    ]);
    cache.insert({ start: fromSec(0), end: fromSec(1) }, [
      { topic: "", receiveTime: fromSec(0), message: "a" },
    ]);
    cache.insert({ start: fromSec(1), end: fromSec(2) }, [
      { topic: "", receiveTime: fromSec(1), message: "b" },
    ]);

    expect(cache.fullyLoadedRanges()).toEqual([{ start: fromSec(0), end: fromSec(3) }]);
    expect(cache.getMessages({ start: fromSec(0), end: fromSec(3) })).toEqual([
      { topic: "", receiveTime: fromSec(0), message: "a" },
      { topic: "", receiveTime: fromSec(1), message: "b" },
      { topic: "", receiveTime: fromSec(2), message: "c" },
    ]);
  });

  it("inserts disjoint ranges in correct order", () => {
    const ranges: [number, number][] = [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [8, 9],
      [10, 11],
    ];
    for (const permutation of permutations(ranges)) {
      const cache = new MessageMemoryCache({ start: fromSec(0), end: fromSec(11) });
      for (const [start, end] of permutation) {
        cache.insert({ start: fromSec(start), end: fromSec(end) }, [
          { topic: "", receiveTime: fromSec(start), message: { start, end } },
        ]);
      }
      expect(cache.fullyLoadedRanges()).toEqual(
        ranges.map(([start, end]) => ({ start: fromSec(start), end: fromSec(end) })),
      );
    }
  });

  it("inserts and merges adjacent ranges in correct order", () => {
    const ranges: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ];
    for (const permutation of permutations(ranges)) {
      const cache = new MessageMemoryCache({ start: fromSec(0), end: fromSec(6) });
      for (const [start, end] of permutation) {
        cache.insert({ start: fromSec(start), end: fromSec(end) }, [
          { topic: "", receiveTime: fromSec(start), message: { start, end } },
        ]);
      }
      expect(cache.fullyLoadedRanges()).toEqual([{ start: fromSec(0), end: fromSec(6) }]);
      expect(cache.getMessages({ start: fromSec(0), end: fromSec(6) })).toEqual([
        { topic: "", receiveTime: fromSec(0), message: { start: 0, end: 1 } },
        { topic: "", receiveTime: fromSec(1), message: { start: 1, end: 2 } },
        { topic: "", receiveTime: fromSec(2), message: { start: 2, end: 3 } },
        { topic: "", receiveTime: fromSec(3), message: { start: 3, end: 4 } },
        { topic: "", receiveTime: fromSec(4), message: { start: 4, end: 5 } },
        { topic: "", receiveTime: fromSec(5), message: { start: 5, end: 6 } },
      ]);
    }
  });

  it.each(
    [0, 1, 2, 3, 4].flatMap((leading) => [0, 1, 2, 3, 4].map((trailing) => [leading, trailing])),
  )(
    "extracts only requested messages (%s leading and %s trailing messages)",
    (leading, trailing) => {
      const cache = new MessageMemoryCache({ start: fromSec(0), end: fromSec(2) });
      const messages = [
        { topic: "", receiveTime: { sec: 1, nsec: 0 }, message: "0" },
        { topic: "", receiveTime: { sec: 1, nsec: 1 }, message: "1" },
        { topic: "", receiveTime: { sec: 1, nsec: 2 }, message: "2" },
        { topic: "", receiveTime: { sec: 1, nsec: 3 }, message: "3" },
        { topic: "", receiveTime: { sec: 1, nsec: 4 }, message: "4" },
        { topic: "", receiveTime: { sec: 1, nsec: 5 }, message: "5" },
      ];

      for (let i = 0; i < leading; i++) {
        messages.unshift({ topic: "", receiveTime: { sec: 0, nsec: i }, message: `leading-${i}` });
      }
      for (let i = 0; i < trailing; i++) {
        messages.push({ topic: "", receiveTime: { sec: 2, nsec: i }, message: `trailing-${i}` });
      }

      cache.insert({ start: fromSec(0), end: fromSec(2) }, messages);
      expect(cache.getMessages({ start: { sec: 1, nsec: 1 }, end: { sec: 1, nsec: 5 } })).toEqual([
        { topic: "", receiveTime: { sec: 1, nsec: 1 }, message: "1" },
        { topic: "", receiveTime: { sec: 1, nsec: 2 }, message: "2" },
        { topic: "", receiveTime: { sec: 1, nsec: 3 }, message: "3" },
        { topic: "", receiveTime: { sec: 1, nsec: 4 }, message: "4" },
      ]);
      expect(cache.getMessages({ start: { sec: 1, nsec: 0 }, end: { sec: 1, nsec: 5 } })).toEqual([
        { topic: "", receiveTime: { sec: 1, nsec: 0 }, message: "0" },
        { topic: "", receiveTime: { sec: 1, nsec: 1 }, message: "1" },
        { topic: "", receiveTime: { sec: 1, nsec: 2 }, message: "2" },
        { topic: "", receiveTime: { sec: 1, nsec: 3 }, message: "3" },
        { topic: "", receiveTime: { sec: 1, nsec: 4 }, message: "4" },
      ]);
      expect(cache.getMessages({ start: { sec: 1, nsec: 0 }, end: { sec: 1, nsec: 6 } })).toEqual([
        { topic: "", receiveTime: { sec: 1, nsec: 0 }, message: "0" },
        { topic: "", receiveTime: { sec: 1, nsec: 1 }, message: "1" },
        { topic: "", receiveTime: { sec: 1, nsec: 2 }, message: "2" },
        { topic: "", receiveTime: { sec: 1, nsec: 3 }, message: "3" },
        { topic: "", receiveTime: { sec: 1, nsec: 4 }, message: "4" },
        { topic: "", receiveTime: { sec: 1, nsec: 5 }, message: "5" },
      ]);
    },
  );
});
