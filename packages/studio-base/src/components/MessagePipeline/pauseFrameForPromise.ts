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

import promiseTimeout from "@foxglove/studio-base/util/promiseTimeout";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

export type FramePromise = { name: string; promise: Promise<void> };

// Wait longer before erroring if there's no user waiting (in automated run)
export const MAX_PROMISE_TIMEOUT_TIME_MS = 5000;

export async function pauseFrameForPromises(promises: FramePromise[]): Promise<void> {
  try {
    await promiseTimeout(
      Promise.all(promises.map(async ({ promise }) => await promise)),
      MAX_PROMISE_TIMEOUT_TIME_MS,
    );
  } catch (error) {
    // An async render task failed to finish in time; some panels may display data from the wrong frame.
    const isTimeoutError = (error as Error).message.includes("Promise timed out");
    if (!isTimeoutError) {
      sendNotification("Player ", error, "app", "error");
      return;
    }
  }
}
