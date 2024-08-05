// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export default function setImmediate(
  callback: (..._args: unknown[]) => void,
  ...args: unknown[]
): NodeJS.Immediate {
  void Promise.resolve().then(() => {
    callback(...args);
  });
  return undefined as unknown as NodeJS.Immediate;
}
