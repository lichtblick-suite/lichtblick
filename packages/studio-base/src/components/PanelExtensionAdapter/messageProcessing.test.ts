// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { forEachSortedArrays } from "./messageProcessing";

describe("forEachSortedArrays", () => {
  it("should not call forEach for empty arrays", () => {
    const forEach = jest.fn();
    const arr: number[] = [];
    forEachSortedArrays([arr, arr], (a, b) => a - b, forEach);
    expect(forEach).not.toHaveBeenCalled();
  });
  it("merges arrays with exclusive ranges", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 2, 3];
    const arr2 = [4, 5, 6];

    forEachSortedArrays([arr1, arr2], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("merges two interleaved arrays", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 3, 5];
    const arr2 = [2, 4, 6];

    forEachSortedArrays([arr1, arr2], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("merges three interleaved arrays", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 4, 7];
    const arr2 = [2, 5, 8];
    const arr3 = [3, 6, 9];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("merges three exclusive arrays", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [4, 5, 6];
    const arr2 = [1, 2, 3];
    const arr3 = [7, 8, 9];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("merges three identical arrays", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    const arr3 = [1, 2, 3];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });
  it("merges two identical arrays and one empty array", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    const arr3: number[] = [];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 1, 2, 2, 3, 3]);
  });
  it("merge arrays of all the same number and a sequence of numbers", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [3, 3, 3];
    const arr2 = [1, 2, 3, 4];
    const arr3: number[] = [];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 3, 3, 3, 4]);
  });
});
