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

import { useEffect } from "react";

// A small React hook to fire the cleanup callback when the component unmounts.
export default function useCleanup(teardown: () => void): void {
  useEffect(() => {
    return () => {
      teardown();
    };
    // The passed-in teardown callback is expected to not need to change.
    // For call site ergonomics we exclude it from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
