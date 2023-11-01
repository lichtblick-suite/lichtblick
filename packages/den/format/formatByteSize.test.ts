// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { formatByteSize } from "./formatByteSize";

describe("formatByteSize", () => {
  it.each([
    [0, "0 Bytes"],
    [1023, "1023 Bytes"],
    [1024, "1.0 KiB"],
    [1023.9 * Math.pow(1024, 1), "1023.9 KiB"],
    [1023.9 * Math.pow(1024, 1) + 1, "1.0 MiB"],
    [1024 * Math.pow(1024, 1), "1.0 MiB"],
    [1023.9 * Math.pow(1024, 2), "1023.9 MiB"],
    [1023.9 * Math.pow(1024, 2) + 1, "1.0 GiB"],
    [1024 * Math.pow(1024, 2), "1.0 GiB"],
    [1023.9 * Math.pow(1024, 3), "1023.9 GiB"],
    [1023.9 * Math.pow(1024, 3) + 1, "1.0 TiB"],
    [1024 * Math.pow(1024, 3), "1.0 TiB"],
    [1023.9 * Math.pow(1024, 4), "1023.9 TiB"],
    [1023.9 * Math.pow(1024, 4) + 1, "1.0 PiB"],
    [1024 * Math.pow(1024, 4), "1.0 PiB"],
    [1024 * Math.pow(1024, 5), "1024.0 PiB"],
  ])("formats %o as %s", (num, str) => {
    expect(formatByteSize(num)).toBe(str);
  });
});
