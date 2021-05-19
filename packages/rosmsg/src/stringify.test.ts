// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { parse } from "./parse";
import { stringify } from "./stringify";

describe("stringify", () => {
  it("round trips a definition into canonical format", () => {
    const messageDefinition = `
      uint32 foo = 55
      int32 bar=-11 # Comment # another comment
      string test
      float32 baz= \t -32.25
      bool someBoolean = 0
      Point[] points
      string fooStr = Foo    ${""}
      string EXAMPLE="#comments" are ignored, and leading and trailing whitespace removed
      ============
      MSG: geometry_msgs/Point
      float64 x
    `;
    const types = parse(messageDefinition);

    const output = stringify(types);
    expect(output).toEqual(`uint32 foo = 55
int32 bar = -11
float32 baz = -32.25
bool someBoolean = false
string fooStr = Foo
string EXAMPLE = "#comments" are ignored, and leading and trailing whitespace removed

string test
geometry_msgs/Point[] points

================================================================================
MSG: geometry_msgs/Point

float64 x
`);
  });
});
