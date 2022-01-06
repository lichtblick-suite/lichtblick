// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Provide a shim for global process variable users
// We avoid using the npm process module since it has unfavorable performance for process.nextTick
// and uses setTimeout(..., 0). Instead we use queueMicrotask which is much faster.
const process = {
  // We want to be able to use Function type for _fn_ param
  // eslint-disable-next-line @typescript-eslint/ban-types
  nextTick: (fn: Function, ...args: unknown[]): void => {
    queueMicrotask(() => {
      fn(...args);
    });
  },

  title: "browser",
  browser: true,
  env: {},
  argv: [],
};

// ts-prune-ignore-next
export default process;
