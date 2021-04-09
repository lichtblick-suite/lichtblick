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

// Call _warn_ if a given value changes twice within 200 ms
export default function useShouldNotChangeOften<T>(value: T, warn: () => void): T {
  const prev = useRef(value);
  const prevPrev = useRef(value);
  const lastTime = useRef<number>(Date.now());
  if (
    value !== prev.current &&
    prev.current !== prevPrev.current &&
    Date.now() - lastTime.current < 200
  ) {
    warn();
  }
  prevPrev.current = prev.current;
  prev.current = value;
  lastTime.current = Date.now();
  return value;
}
