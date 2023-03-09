// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ArrayMap } from "./ArrayMap";

describe("ArrayMap", () => {
  it("works with Number keys", () => {
    const list = new ArrayMap<number, string>();
    expect(list.size).toBe(0);
    expect(list.at(0)).toBeUndefined();
    expect(list.minEntry()).toBeUndefined();
    expect(list.maxEntry()).toBeUndefined();
    expect(list.minKey()).toBeUndefined();
    expect(list.maxKey()).toBeUndefined();
    expect(list.binarySearch(1)).toBe(-1);
    expect(list.pop()).toBeUndefined();
    expect(list.shift()).toBeUndefined();

    list.set(1, "a");
    expect(list.size).toBe(1);
    expect(list.at(0)).toEqual([1, "a"]);
    expect(list.minEntry()).toEqual([1, "a"]);
    expect(list.maxEntry()).toEqual([1, "a"]);
    expect(list.minKey()).toBe(1);
    expect(list.maxKey()).toBe(1);
    expect(list.binarySearch(1)).toBe(0);
    expect(list.pop()).toEqual([1, "a"]);
    expect(list.shift()).toBeUndefined();
    expect(list.size).toBe(0);

    list.set(1, "a");
    expect(list.size).toBe(1);
    expect(list.shift()).toEqual([1, "a"]);
    expect(list.pop()).toBeUndefined();
    expect(list.shift()).toBeUndefined();
    expect(list.size).toBe(0);

    list.set(1, "one");
    list.set(4, "four");
    list.set(2, "two");
    expect(list.size).toBe(3);
    expect(list.at(1)).toEqual([2, "two"]);
    expect(list.binarySearch(0)).toBe(-1);
    expect(list.binarySearch(1)).toBe(0);
    expect(list.binarySearch(2)).toBe(1);
    expect(list.binarySearch(3)).toBe(~2);
    expect(list.binarySearch(4)).toBe(2);
    expect(list.binarySearch(5)).toBe(~3);
    expect(list.binarySearch(6)).toBe(~3);
  });

  it("works with BigInt keys", () => {
    const list = new ArrayMap<bigint, string>();
    expect(list.size).toBe(0);
    expect(list.at(0)).toBeUndefined();
    expect(list.minEntry()).toBeUndefined();
    expect(list.maxEntry()).toBeUndefined();
    expect(list.minKey()).toBeUndefined();
    expect(list.maxKey()).toBeUndefined();
    expect(list.binarySearch(1n)).toBe(-1);
    expect(list.pop()).toBeUndefined();
    expect(list.shift()).toBeUndefined();

    list.set(1n, "a");
    expect(list.size).toBe(1);
    expect(list.at(0)).toEqual([1n, "a"]);
    expect(list.minEntry()).toEqual([1n, "a"]);
    expect(list.maxEntry()).toEqual([1n, "a"]);
    expect(list.minKey()).toBe(1n);
    expect(list.maxKey()).toBe(1n);
    expect(list.binarySearch(1n)).toBe(0);
    expect(list.pop()).toEqual([1n, "a"]);
    expect(list.shift()).toBeUndefined();
    expect(list.size).toBe(0);

    list.set(1n, "a");
    expect(list.size).toBe(1);
    expect(list.shift()).toEqual([1n, "a"]);
    expect(list.pop()).toBeUndefined();
    expect(list.shift()).toBeUndefined();
    expect(list.size).toBe(0);

    list.set(1n, "one");
    list.set(4n, "four");
    list.set(2n, "two");
    expect(list.size).toBe(3);
    expect(list.at(1)).toEqual([2n, "two"]);
    expect(list.binarySearch(0n)).toBe(-1);
    expect(list.binarySearch(1n)).toBe(0);
    expect(list.binarySearch(2n)).toBe(1);
    expect(list.binarySearch(3n)).toBe(~2);
    expect(list.binarySearch(4n)).toBe(2);
    expect(list.binarySearch(5n)).toBe(~3);
    expect(list.binarySearch(6n)).toBe(~3);
  });

  it("removes elements after key", () => {
    const list = new ArrayMap<number, string>();
    const data = [...Array(10).keys()];
    data.forEach((val) => list.set(val, String(val)));
    list.removeAfter(4.5);
    expect(list.size).toBe(5);
    expect(list.binarySearch(0)).toBe(0);
    expect(list.binarySearch(1)).toBe(1);
    expect(list.binarySearch(2)).toBe(2);
    expect(list.binarySearch(3)).toBe(3);
    expect(list.binarySearch(4)).toBe(4);
    expect(list.binarySearch(5)).toBe(~5);
    expect(list.binarySearch(6)).toBe(~5);
    expect(list.binarySearch(7)).toBe(~5);
    expect(list.binarySearch(8)).toBe(~5);
    expect(list.binarySearch(9)).toBe(~5);
  });

  it("removes elements before key", () => {
    const list = new ArrayMap<number, string>();
    const data = [...Array(10).keys()];
    data.forEach((val) => list.set(val, String(val)));
    list.removeBefore(4.5);
    expect(list.size).toBe(5);
    expect(list.binarySearch(0)).toBe(-1);
    expect(list.binarySearch(1)).toBe(-1);
    expect(list.binarySearch(2)).toBe(-1);
    expect(list.binarySearch(3)).toBe(-1);
    expect(list.binarySearch(4)).toBe(-1);
    expect(list.binarySearch(5)).toBe(0);
    expect(list.binarySearch(6)).toBe(1);
    expect(list.binarySearch(7)).toBe(2);
    expect(list.binarySearch(8)).toBe(3);
    expect(list.binarySearch(9)).toBe(4);
  });

  it("removes specific elements", () => {
    const list = new ArrayMap<number, string>();
    const data = [...Array(10).keys()];
    data.forEach((val) => list.set(val, String(val)));
    list.remove(3);
    expect(list.size).toBe(9);
    expect(list.binarySearch(0)).toBe(0);
    expect(list.binarySearch(1)).toBe(1);
    expect(list.binarySearch(2)).toBe(2);
    expect(list.binarySearch(3)).toBe(~3);
    expect(list.binarySearch(4)).toBe(3);
    expect(list.binarySearch(5)).toBe(4);
    expect(list.binarySearch(6)).toBe(5);
    expect(list.binarySearch(7)).toBe(6);
    expect(list.binarySearch(8)).toBe(7);
    expect(list.binarySearch(9)).toBe(8);
  });
});
