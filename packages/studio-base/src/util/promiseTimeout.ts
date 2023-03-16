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

async function promiseTimeout<T>(
  promise: Promise<T>,
  ms = 30000,
  reason = "unknown reason",
): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  return await Promise.race([
    promise.then((result) => {
      if (id != undefined) {
        clearTimeout(id);
      }
      return result;
    }),
    new Promise<T>((_resolve, reject) => {
      id = setTimeout(() => reject(new Error(`Promise timed out after ${ms}ms: ${reason} `)), ms);
    }),
  ]);
}

export default promiseTimeout;
