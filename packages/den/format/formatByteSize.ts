// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export function formatByteSize(size: number): string {
  const suffixes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let value = size;
  let suffix = 0;
  while (value > 1023.9 && suffix + 1 < suffixes.length) {
    value /= 1024;
    suffix++;
  }
  return `${value.toFixed(suffix === 0 ? 0 : 1)} ${suffixes[suffix]}`;
}
