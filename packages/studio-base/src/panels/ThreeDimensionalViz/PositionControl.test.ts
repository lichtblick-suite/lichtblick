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

import { parsePosition } from "./PositionControl";

describe("parsePosition", () => {
  it("parses numbers correctly", () => {
    expect(parsePosition("0\n0")).toEqual([0, 0, 0]);
    expect(parsePosition("0\n1")).toEqual([0, 1, 0]);
    expect(parsePosition("1111.111\n2222.222")).toEqual([1111.111, 2222.222, 0]);
    expect(parsePosition("-1111.111\n-2222.222")).toEqual([-1111.111, -2222.222, 0]);
  });
  it("parses arrays", () => {
    expect(parsePosition("[-1.1,-2.1]")).toEqual([-1.1, -2.1, 0]);
    expect(parsePosition("   [ -1 , -0 ]  ")).toEqual([-1, -0, 0]);
  });
  it("parses objects", () => {
    expect(parsePosition("{x:1,y:2}")).toEqual([1, 2, 0]);
    expect(
      parsePosition(`{
        x: 1,
        y: 2,
        z: 3,
      }`),
    ).toEqual([1, 2, 0]);
  });
});
