// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { concatData } from "./concatData";

describe("concatData", () => {
  it("concatData works", () => {
    expect(concatData([])).toEqual(new Uint8Array());
    expect(concatData([new Uint8Array([1, 2, 3])])).toEqual(new Uint8Array([1, 2, 3]));
    expect(concatData([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])])).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6]),
    );
    expect(
      concatData([
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array(),
        new Uint8Array([7]),
      ]),
    ).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
  });
});
