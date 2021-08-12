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

import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import buildSampleMessage, { builtinSampleValues } from "./buildSampleMessage";

describe("buildSampleMessage", () => {
  const datatypes: RosDatatypes = new Map(
    Object.entries({
      A: { definitions: [] },
      B: { definitions: [{ name: "data", type: "A" }] },
      C: {
        definitions: [
          { name: "foo", type: "B", isConstant: true },
          { name: "bar", type: "B", isConstant: true, isArray: true },
        ],
      },
      D: { definitions: [{ name: "foo", type: "B", isArray: true }] },
      E: { definitions: [{ name: "foo", type: "B", isArray: true, arrayLength: 4 }] },
    }),
  );

  it("handles empty types", () => {
    expect(buildSampleMessage(datatypes, "A")).toEqual({});
  });
  it("handles single field", () => {
    expect(buildSampleMessage(datatypes, "B")).toEqual({ data: {} });
  });
  it("ignores constants", () => {
    expect(buildSampleMessage(datatypes, "C")).toEqual({});
  });
  it("handles variable-length arrays", () => {
    expect(buildSampleMessage(datatypes, "D")).toEqual({ foo: [{ data: {} }] });
  });
  it("handles fixed-length arrays", () => {
    expect(buildSampleMessage(datatypes, "E")).toEqual({
      foo: [{ data: {} }, { data: {} }, { data: {} }, { data: {} }],
    });
  });

  it("handles builtin types", () => {
    for (const type in builtinSampleValues) {
      expect(buildSampleMessage(new Map(), type)).toEqual(builtinSampleValues[type]);
      expect(
        buildSampleMessage(
          new Map(Object.entries({ A: { definitions: [{ name: "data", type }] } })),
          "A",
        ),
      ).toEqual({
        data: builtinSampleValues[type],
      });
    }
  });
});
