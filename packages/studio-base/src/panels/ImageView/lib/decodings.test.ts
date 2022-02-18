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

import { decodeBayerRGGB8 } from "./decodings";

describe("decodeBayer*()", () => {
  it("works for simple data", () => {
    const output = new Uint8ClampedArray(2 * 2 * 4);
    decodeBayerRGGB8(new Uint8Array([10, 20, 30, 40]), 2, 2, output);
    expect(output).toStrictEqual(
      new Uint8ClampedArray([10, 20, 40, 255, 10, 20, 40, 255, 10, 30, 40, 255, 10, 30, 40, 255]),
    );
  });
});
