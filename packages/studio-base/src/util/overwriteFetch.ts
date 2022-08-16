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

// Overwrite the default fetch error handler with one that catches one message: "Failed to fetch". We see this often
// in our logs and want the logs to more fully reflect the error message.
export default function overwriteFetch(): void {
  const originalFetch = global.fetch;
  global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    // Use this replacement error instead of the original one, because this one will have the correct stack trace.
    const replacementError = new TypeError(`Failed to fetch: ${url}`);
    return await originalFetch(url, init).catch((error) => {
      if (error.message === "Failed to fetch") {
        throw replacementError;
      }
      throw error;
    });
  };
}
