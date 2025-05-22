// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

  // Do not specify types here, they will be inferred from context. See
  // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/66824#issuecomment-1753778002
  global.fetch = async (input, init) => {
    // Use this replacement error instead of the original one, because this one will have the correct stack trace.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const replacementError = new TypeError(`Failed to fetch: ${input}`);
    // Since both node types and dom types are in scope here, the input types for `fetch` conflict.
    return await originalFetch(input as Parameters<typeof originalFetch>[0], init).catch(
      (error: unknown) => {
        if ((error as Error).message === "Failed to fetch") {
          throw replacementError;
        }
        throw error;
      },
    );
  };
}
