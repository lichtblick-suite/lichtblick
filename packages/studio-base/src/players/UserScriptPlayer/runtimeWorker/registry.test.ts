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
import { containsFuncDeclaration, stringifyFuncsInObject, requireImplementation } from "./registry";

const someFunc = (a: number, b: number) => a + b;
const otherArgs = [1, false, "abc"];
describe("containsFuncDeclaration", () => {
  it("returns true if a single arg is a function declaration", () => {
    expect(containsFuncDeclaration([someFunc])).toEqual(true);
  });

  it("returns true if one of many args is a function declaration", () => {
    expect(
      containsFuncDeclaration([
        ...otherArgs,
        () => {
          // no-op
        },
      ]),
    ).toEqual(true);
  });

  it("returns true if a single arg contains a nested function declaration", () => {
    expect(containsFuncDeclaration([{ someKey: someFunc }])).toEqual(true);
  });

  it("returns true if one of many args contains a nested function declaration", () => {
    expect(containsFuncDeclaration([...otherArgs, { someKey: someFunc }])).toEqual(true);
    expect(
      containsFuncDeclaration([...otherArgs, { someKey: { someNestedKey: someFunc } }]),
    ).toEqual(true);
  });
});

describe("stringifyFuncsInObject", () => {
  it("stringifies just the functions in an object", () => {
    expect(stringifyFuncsInObject({ someKey: someFunc, anotherKey: someFunc })).toEqual({
      someKey: "(a, b) => a + b",
      anotherKey: "(a, b) => a + b",
    });
    expect(
      stringifyFuncsInObject({
        someKey: someFunc,
        anotherKey: { nestedKey: someFunc, anotherNestedKey: 5 },
      }),
    ).toEqual({
      someKey: "(a, b) => a + b",
      anotherKey: { nestedKey: "(a, b) => a + b", anotherNestedKey: 5 },
    });
    expect(
      stringifyFuncsInObject({
        someKey: true,
        anotherKey: { nestedKey: undefined, anotherNestedKey: undefined },
      }),
    ).toEqual({
      someKey: true,
      anotherKey: { nestedKey: undefined, anotherNestedKey: undefined },
    });
  });
});

describe("requireImplementation", () => {
  it("correctly matches modules", () => {
    const map = new Map<string, string>();
    map.set(
      "main.js",
      `
        const { x } = require('module');
      `,
    );
    map.set(
      "module.js",
      `
        exports.x = "hello";
      `,
    );
    expect(requireImplementation("main", map)).toEqual({});
  });
  it("correctly matches nested modules", () => {
    const map = new Map<string, string>();
    map.set(
      "main.js",
      `
        const { x } = require('./1');
        exports.y = x;
      `,
    );
    map.set(
      "1.js",
      `
        const { z } = require('./2');
        exports.x = z;
      `,
    );
    map.set(
      "2.js",
      `
        exports.z = "hello";
      `,
    );

    expect(requireImplementation("main", map)).toEqual({ y: "hello" });
  });
});
