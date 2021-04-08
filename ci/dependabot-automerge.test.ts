// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { shouldAutomerge } from "./dependabot-automerge";

describe("shouldAutomerge", () => {
  it("parses git commits", () => {
    // auto-merge minor and patch versions
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0 to 2.4.1")).toStrictEqual(true);
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0 to 2.5.0")).toStrictEqual(true);
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0-rc1 to 2.4.0")).toStrictEqual(true);

    // allow trailing whitespace
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0 to 2.4.1 ")).toStrictEqual(true);
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0 to 2.4.1\n")).toStrictEqual(true);
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0 to 2.4.1 \n")).toStrictEqual(true);

    // do not auto-merge major versions
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0 to 3.0.0")).toStrictEqual(false);
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0 to 3.0.0-rc1")).toStrictEqual(false);

    // return undefined for unexpected input
    expect(shouldAutomerge("")).toStrictEqual(undefined);
    expect(shouldAutomerge("Bump xmlbuilder2 from 2.4.0 invalid")).toStrictEqual(undefined);
  });
});
