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

import tick from "@foxglove/studio-base/util/tick";

export async function dragAndDrop(
  source: (Element | undefined) | (() => Element | undefined),
  target: (Element | undefined) | (() => Element | undefined),
): Promise<void> {
  const sourceEl = typeof source === "function" ? source() : source;
  if (!sourceEl) {
    return;
  }

  sourceEl.dispatchEvent(new MouseEvent("dragstart", { bubbles: true }));
  await tick();
  sourceEl.dispatchEvent(new MouseEvent("dragenter", { bubbles: true }));
  await tick();

  const targetEl = typeof target === "function" ? target() : target;
  if (targetEl) {
    targetEl.dispatchEvent(new MouseEvent("dragover", { bubbles: true }));
    targetEl.dispatchEvent(new MouseEvent("drop", { bubbles: true }));
  }
  sourceEl.dispatchEvent(new MouseEvent("dragend", { bubbles: true }));
}
