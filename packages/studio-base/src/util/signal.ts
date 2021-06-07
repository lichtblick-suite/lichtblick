// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

export type Signal<T> = Promise<T> & {
  resolve: (arg0: T) => void;
  reject: (arg0: Error) => void;
};

export default function signal<T = void>(): Signal<T> {
  let resolve: ((_: T) => void) | undefined;
  let reject: ((_: Error) => void) | undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return Object.assign(promise, { resolve: resolve!, reject: reject! });
}
