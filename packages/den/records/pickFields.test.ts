// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { pickFields } from "./pickFields";

describe("pickFields", () => {
  it("returns an empty object with no picked fields", () => {
    expect(pickFields({ a: 1 }, [])).toEqual({});
  });

  it("picks fields", () => {
    const record = { a: 1, b: 2, c: { d: 4 } };
    const result = pickFields(record, ["a", "c", "not-present"]);

    expect(result).toStrictEqual({ a: 1, c: { d: 4 } });
  });
});
