// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { backoffTime } from "./backoff";

describe("backoffTime", () => {
  it("works", () => {
    expect(backoffTime(0, 60, 100, () => 0.5)).toEqual(51);
    expect(backoffTime(1, 60, 100, () => 0.5)).toEqual(52);
    expect(backoffTime(2, 60, 100, () => 0.5)).toEqual(54);
    expect(backoffTime(3, 60, 100, () => 0.5)).toEqual(58);
    expect(backoffTime(4, 60, 100, () => 0.5)).toEqual(60);

    expect(backoffTime(0, 60, 100, () => 0.7)).toEqual(60);
    expect(backoffTime(0, 60, 100, () => 0.0)).toEqual(1);
    expect(backoffTime(5, 60, 100, () => 0.0)).toEqual(32);
    expect(backoffTime(6, 60, 100, () => 0.0)).toEqual(60);
  });
});
