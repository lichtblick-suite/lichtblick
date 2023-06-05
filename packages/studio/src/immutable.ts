// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Immutable types borrowed from ts-essentials: https://github.com/ts-essentials/ts-essentials
/**
The MIT License

Copyright (c) 2018-2019 Chris Kaczor (github.com/krzkaczor)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// eslint-disable-next-line no-restricted-syntax
export type Primitive = string | number | boolean | bigint | symbol | undefined | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyArray<Type = any> = Array<Type> | ReadonlyArray<Type>;

// eslint-disable-next-line @typescript-eslint/ban-types
export type Builtin = Primitive | Function | Date | Error | RegExp;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IsTuple<Type> = Type extends readonly any[]
  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any[] extends Type
    ? never
    : Type
  : never;

export type IsUnknown<Type> = IsAny<Type> extends true
  ? false
  : unknown extends Type
  ? true
  : false;

// https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
export type IsAny<Type> = 0 extends 1 & Type ? true : false;

export type Immutable<Type> = Type extends Exclude<Builtin, Error>
  ? Type
  : Type extends Map<infer Keys, infer Values>
  ? ReadonlyMap<Immutable<Keys>, Immutable<Values>>
  : Type extends ReadonlyMap<infer Keys, infer Values>
  ? ReadonlyMap<Immutable<Keys>, Immutable<Values>>
  : Type extends WeakMap<infer Keys, infer Values>
  ? WeakMap<Immutable<Keys>, Immutable<Values>>
  : Type extends Set<infer Values>
  ? ReadonlySet<Immutable<Values>>
  : Type extends ReadonlySet<infer Values>
  ? ReadonlySet<Immutable<Values>>
  : Type extends WeakSet<infer Values>
  ? WeakSet<Immutable<Values>>
  : Type extends Promise<infer Value>
  ? Promise<Immutable<Value>>
  : Type extends AnyArray<infer Values>
  ? Type extends IsTuple<Type>
    ? { readonly [Key in keyof Type]: Immutable<Type[Key]> }
    : ReadonlyArray<Immutable<Values>>
  : // eslint-disable-next-line @typescript-eslint/ban-types
  Type extends {}
  ? { readonly [Key in keyof Type]: Immutable<Type[Key]> }
  : IsUnknown<Type> extends true
  ? unknown
  : Readonly<Type>;
