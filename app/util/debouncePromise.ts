// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

type DebouncedFn<Args extends unknown[]> = ((...args: Args) => void) & {
  // the currently executing promise, if any
  currentPromise?: Promise<void>;
};

// debouncePromise returns a function which wraps calls to `fn`.
// The returned debounceFn ensures that only one `fn` call is executing at a time.
// If debounceFn is called while `fn` is still executing, it will queue the call until the
// current invocation is complete.
// If debounceFn is called multiple times while `fn` is still executing, then only the last
// call's arguments will be saved for the next execution of `fn`.
export default function debouncePromise<Args extends unknown[]>(
  fn: (...args: Args) => Promise<void>,
): DebouncedFn<Args> {
  // Whether we are currently waiting for a promise returned by `fn` to resolve.
  let calling = false;
  // Whether another call to the debounced function was made while a call was in progress.
  let callPending: Args | undefined;

  const debouncedFn: DebouncedFn<Args> = (...args: Args) => {
    if (calling) {
      callPending = args;
    } else {
      start(args);
    }
  };

  function start(args: Args) {
    calling = true;
    callPending = undefined;

    debouncedFn.currentPromise = fn(...args).finally(() => {
      calling = false;
      debouncedFn.currentPromise = undefined;
      if (callPending) {
        start(callPending);
      }
    });
  }

  return debouncedFn;
}
