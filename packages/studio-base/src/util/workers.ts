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

export const inWebWorker = (): boolean => {
  return (
    typeof global.postMessage !== "undefined" &&
    typeof WorkerGlobalScope !== "undefined" &&
    self instanceof WorkerGlobalScope
  );
};

// To debug shared workers, enter 'chrome://inspect/#workers' into the url bar.
export const inSharedWorker = (): boolean =>
  typeof SharedWorkerGlobalScope !== "undefined" && self instanceof SharedWorkerGlobalScope;

export const enforceFetchIsBlocked = <R, Args extends readonly unknown[]>(
  fn: (...args: Args) => R,
): ((...args: Args) => Promise<R>) => {
  const canFetch =
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    typeof fetch !== "undefined" &&
    fetch("data:test")
      .then(() => true)
      .catch(() => false);
  return async (...args) => {
    if (await canFetch) {
      throw new Error("Content security policy too loose.");
    }
    return fn(...args);
  };
};
