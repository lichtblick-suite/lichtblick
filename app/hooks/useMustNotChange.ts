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

import { useRef } from "react";

function format(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return "<unknown object>";
  }
}

// Throw an error if the given value changes between renders.
export default function useMustNotChange<T>(value: T, message: string): T {
  const ref = useRef(value);
  if (value !== ref.current) {
    throw new Error(`${message}\nOld: ${format(ref.current)}\nNew: ${format(value)}`);
  }
  return value;
}
