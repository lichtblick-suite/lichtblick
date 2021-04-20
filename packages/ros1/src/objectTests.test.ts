// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEmptyPlainObject, isPlainObject } from "./objectTests";

/* eslint-disable no-restricted-syntax */

class NonPlainObject {}

describe("isPlainObject", () => {
  it("works", () => {
    expect(isPlainObject(undefined)).toEqual(false);
    expect(isPlainObject(null)).toEqual(false);
    expect(isPlainObject("")).toEqual(false);
    expect(isPlainObject("a")).toEqual(false);
    expect(isPlainObject(0)).toEqual(false);
    expect(isPlainObject(1)).toEqual(false);
    expect(isPlainObject(false)).toEqual(false);
    expect(isPlainObject(true)).toEqual(false);
    expect(isPlainObject(new Date())).toEqual(false);
    expect(isPlainObject(new NonPlainObject())).toEqual(false);

    expect(isPlainObject({})).toEqual(true);
    expect(isPlainObject({ a: 1 })).toEqual(true);
    expect(isPlainObject(new Object())).toEqual(true);
    expect(isPlainObject(Object.create(null))).toEqual(true);
  });
});

describe("isEmptyPlainObject", () => {
  it("works", () => {
    expect(isEmptyPlainObject(undefined)).toEqual(false);
    expect(isEmptyPlainObject(null)).toEqual(false);
    expect(isEmptyPlainObject("")).toEqual(false);
    expect(isEmptyPlainObject("a")).toEqual(false);
    expect(isEmptyPlainObject(0)).toEqual(false);
    expect(isEmptyPlainObject(1)).toEqual(false);
    expect(isEmptyPlainObject(false)).toEqual(false);
    expect(isEmptyPlainObject(true)).toEqual(false);
    expect(isEmptyPlainObject(new Date())).toEqual(false);
    expect(isEmptyPlainObject(new NonPlainObject())).toEqual(false);

    expect(isEmptyPlainObject({})).toEqual(true);
    expect(isEmptyPlainObject({ a: 1 })).toEqual(false);
    expect(isEmptyPlainObject(new Object())).toEqual(true);
    expect(isEmptyPlainObject(Object.create(null))).toEqual(true);
  });
});
