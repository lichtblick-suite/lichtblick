// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import Log from "@lichtblick/log";
import { mightActuallyBePartial } from "@lichtblick/suite-base/util/mightActuallyBePartial";

const log = Log.getLogger(__filename);

async function fallbackCopy(text: string) {
  const body = document.body;
  const el = document.createElement("textarea");
  body.appendChild(el);
  el.value = text;
  el.select();
  await navigator.clipboard.writeText(el.value);
  body.removeChild(el);
}

export default {
  // Copy a string to the clipboard
  async copy(text: string): Promise<void> {
    // attempt to use the new async clipboard methods. If those are not available or fail, fallback to the old
    // `execCommand` method.
    if (mightActuallyBePartial(navigator.clipboard).writeText != undefined) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error: unknown) {
        log.error("Failed to copy to clipboard", error);
        await fallbackCopy(text);
      }
    } else {
      await fallbackCopy(text);
    }
  },
};
