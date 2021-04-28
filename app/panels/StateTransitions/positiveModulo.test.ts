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

import positiveModulo from "./positiveModulo";

describe("positiveModulo", () => {
  it("returns a positive value between 0 (inclusive) and modulus (exclusive)", () => {
    expect(positiveModulo(0, 10)).toEqual(0);
    expect(positiveModulo(10, 10)).toEqual(0);
    expect(positiveModulo(11, 10)).toEqual(1);
    expect(positiveModulo(21, 10)).toEqual(1);
    expect(positiveModulo(-1, 10)).toEqual(9);
    expect(positiveModulo(-11, 10)).toEqual(9);
  });
});
