// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { copyMessageReplacer } from "@foxglove/studio-base/panels/RawMessages/copyMessageReplacer";

describe("copyMessageReplaceer", () => {
  it.each([
    {
      name: "bigint fields to strings",
      input: { foo: 100n },
      out: { foo: "100" },
    },
    {
      name: "Int8Array to array of numbers",
      input: { foo: new Int8Array([10, 20]) },
      out: { foo: [10, 20] },
    },
    {
      name: "BigInt64Array to array of strings",
      input: { foo: new BigInt64Array([10n, 20n]) },
      out: { foo: ["10", "20"] },
    },
  ])("should stringify $name", ({ input, out }) => {
    expect(JSON.stringify(input, copyMessageReplacer)).toEqual(JSON.stringify(out));
  });
});
