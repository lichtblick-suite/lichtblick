// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { find } from "lodash";

import {
  deepParse,
  isBobject,
  deepParseSymbol,
} from "@foxglove-studio/app/util/binaryObjects/messageDefinitionUtils";

type GetArrayElement<T> = (offset: number) => T;

export interface ArrayView<T> extends Iterable<T> {
  readonly get: (index: number) => T;
  readonly length: () => number;
  readonly toArray: () => T[];
  readonly find: (predicate: (item: T, index: number, collection: T[]) => boolean) => T | undefined;
}

// Class is inside a closure to make instance construction cheaper (only two fields to set). The
// getElement and elementSize fields are common to many instances.
export const getArrayView = <T>(getElement: GetArrayElement<T>, elementSize: number) =>
  class BinaryArrayView implements ArrayView<T> {
    _begin: number;
    _length: number;
    constructor(begin: number, length: number) {
      this._begin = begin;
      this._length = length;
    }

    // Unfortunately we can't override the [] operator without a proxy, which is very slow.
    get(index: number): T {
      return getElement(this._begin + index * elementSize);
    }

    length(): number {
      return this._length;
    }

    *[Symbol.iterator](): Iterator<T> {
      let offset = this._begin;
      const length = this._length;
      for (let i = 0; i < length; i += 1) {
        yield getElement(offset);
        offset += elementSize;
      }
    }

    [deepParseSymbol](): T[] {
      const ret = new Array(this._length);
      let offset = this._begin;
      const length = this._length;
      for (let i = 0; i < length; i += 1) {
        const o = getElement(offset);
        ret[i] = isBobject(o) ? deepParse(o) : o;
        offset += elementSize;
      }
      return ret;
    }

    // Shallow parse. Equivalent to [...this], but faster. Used in deep parsing for primitive
    // types, so quite performance-sensitive.
    toArray(): T[] {
      const ret = new Array(this.length());
      let offset = this._begin;
      const length = this._length;
      for (let i = 0; i < length; i += 1) {
        ret[i] = getElement(offset);
        offset += elementSize;
      }
      return ret;
    }

    find(predicate: (item: T, index: number, collection: T[]) => boolean): T | undefined {
      // @ts-expect-error Note(roman): running into weird generic miss-match issues
      // I suspect related to declaring a class inside the function, this feels very anti-pattern
      return find(this.toArray(), predicate);
    }
  };

export class PrimitiveArrayView<T> implements ArrayView<T> {
  value: T[];
  constructor(value: T[]) {
    this.value = value;
  }
  get(index: number): T {
    return this.value[index];
  }
  length() {
    return this.value.length;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (const o of this.value) {
      yield o;
    }
  }
  // Use deepParse(arr)
  [deepParseSymbol](): T[] {
    return this.value;
  }
  toArray(): T[] {
    return this.value;
  }

  find(predicate: (item: T, index: number, collection: T[]) => boolean): T | undefined {
    // @ts-expect-error Note(roman): running into weird generic miss-match issues
    // I suspect related to declaring a class inside the function, this feels very anti-pattern
    return find(this.toArray(), predicate);
  }
}

export const getReverseWrapperArrayView = <T>(Class: any) =>
  class ReverseWrapperArrayView implements ArrayView<T> {
    value: T[];
    constructor(value: T[]) {
      this.value = value;
    }
    get(index: number): T {
      return new Class(this.value[index]);
    }
    length(): number {
      return this.value.length;
    }

    *[Symbol.iterator](): Iterator<T> {
      for (const o of this.value) {
        yield isBobject(o) ? o : new Class(o);
      }
    }
    // Use deepParse(arr)
    [deepParseSymbol](): T[] {
      return this.value.map((o) => (isBobject(o) ? deepParse(o) : deepParse(new Class(o))));
    }
    toArray(): T[] {
      const ret = [];
      let i = 0;
      for (const o of this) {
        ret[i] = o;
        i += 1;
      }
      return ret;
    }

    find(predicate: (item: T, index: number, collection: T[]) => boolean): T | undefined {
      // @ts-expect-error Note(roman): running into weird generic miss-match issues
      // I suspect related to declaring a class inside the function, this feels very anti-pattern
      return find(this.toArray(), predicate);
    }
  };
