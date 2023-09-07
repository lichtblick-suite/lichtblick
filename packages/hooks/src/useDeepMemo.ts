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

import * as _ from "lodash-es";
import { useRef } from "react";

// Continues to return the same instance as long as deep equality is maintained.
export default function useDeepMemo<T>(value: T): T {
  const ref = useRef(value);
  if (_.isEqual(value, ref.current)) {
    return ref.current;
  }
  ref.current = value;
  return value;
}
