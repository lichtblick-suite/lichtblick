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
import shallowequal from "shallowequal";

/**
 * Return initiallyTrue the first time, and again if any of the given deps have changed.
 * @deprecated Render functions may be called more than once before effects are run, so relying on
 * the result of useChangeDetector is dangerous. Instead, track the previously used values at the
 * point they are being used.
 */
export default function useChangeDetector(
  deps: unknown[],
  { initiallyTrue }: { initiallyTrue: boolean },
): boolean {
  const ref = useRef(initiallyTrue ? undefined : deps);
  const changed = !shallowequal(ref.current, deps);
  ref.current = deps;
  return changed;
}
