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

import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

function fallbackCopy(text: string) {
  const body = document.body;
  const el = document.createElement("textarea");
  body.appendChild(el);
  el.value = text;
  el.select();
  document.execCommand("copy");
  body.removeChild(el);
}

export default {
  // Copy a string to the clipboard
  async copy(text: string): Promise<void> {
    // attempt to use the new async clipboard methods. If those are not available or fail, fallback to the old
    // `execCommand` method.
    if (mightActuallyBePartial(navigator.clipboard).writeText != undefined) {
      try {
        return await navigator.clipboard.writeText(text);
      } catch (error) {
        fallbackCopy(text);
      }
    } else {
      fallbackCopy(text);
    }
  },
};
