// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isTypicalFilterName } from "./isTypicalFilterName";

describe("isTypicalFilterName", () => {
  it.each(["id", "trackID", "_id", "track_id", "ID", "Id", "key", "trackId"])(
    "returns true for %s",
    (value) => {
      expect(isTypicalFilterName(value)).toBe(true);
    },
  );

  it.each(["trackiD", "some_key", "iD"])("returns false for %s", (value) => {
    expect(isTypicalFilterName(value)).toBe(false);
  });
});
