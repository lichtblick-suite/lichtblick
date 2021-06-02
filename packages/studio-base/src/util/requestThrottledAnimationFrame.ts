// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Wrapper for `requestAnimationFrame` that will skip a user-specified number of frames before
 * executing the callback.
 * @param callback Function to execute
 * @param skipFrames Number of additional times to call `requestAnimationFrame`
 */
export function requestThrottledAnimationFrame(
  callback: FrameRequestCallback,
  skipFrames: number,
): void {
  let remaining = 1 + skipFrames;

  const fn = (timestamp: number) => {
    if (--remaining <= 0) {
      return callback(timestamp);
    }
    requestAnimationFrame(fn);
  };

  requestAnimationFrame(fn);
}
