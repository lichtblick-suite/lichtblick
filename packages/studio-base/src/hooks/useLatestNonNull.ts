// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useRef } from "react";

// Returns the most recent value of `value` that was not null or undefined.
export default function useLatestNonNull<T>(value: T): T {
  const ref = useRef(value);
  ref.current = value ?? ref.current;
  return ref.current;
}
