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

import { fromPairs } from "lodash";
import { rosPrimitiveTypes } from "rosbag";

import addMessageDefaults from "./addMessageDefaults";

describe("addMessageDefaults", () => {
  it("sets primitve types", () => {
    const rosPrimitiveTypesArray = Array.from(rosPrimitiveTypes);
    const datatypes = fromPairs(
      rosPrimitiveTypesArray.map((typeName) => [
        typeName,
        { fields: [{ type: typeName, name: typeName }] },
      ]),
    );

    for (const typeName of Object.keys(datatypes)) {
      const message: Record<string, unknown> = {};
      addMessageDefaults(datatypes, typeName, message);
      const fieldSetToDefault = message[typeName];

      if (typeName === "string") {
        expect(fieldSetToDefault).toEqual("");
      } else if (typeName === "json") {
        expect(fieldSetToDefault).toEqual({});
      } else if (typeName === "time" || typeName === "duration") {
        expect(fieldSetToDefault).toEqual({ sec: 0, nsec: 0 });
      } else if (typeName === "bool") {
        expect(fieldSetToDefault).toEqual(false);
      } else if (typeName === "float64" || typeName === "float32") {
        expect(fieldSetToDefault).toEqual(NaN);
      } else {
        expect(fieldSetToDefault).toEqual(0);
      }
    }
  });

  it("does not set constant types", () => {
    const datatypes = {
      root: {
        fields: [
          { type: "child", name: "child", isComplex: true, isConstant: true },
          { type: "child", name: "child_array", isComplex: true, isArray: true, isConstant: true },
          { type: "string", name: "string_array", isArray: true, isConstant: true },
          { type: "string", name: "string", isConstant: true },
        ],
      },
      child: { fields: [{ type: "string", name: "string" }] },
    };
    const message = {};
    addMessageDefaults(datatypes, "root", message);
    expect(message).toEqual({});
  });

  it("recursively sets fields in complex types", () => {
    const datatypes = {
      root: { fields: [{ type: "child", name: "child", isComplex: true }] },
      child: { fields: [{ type: "string", name: "string" }] },
    };
    const message: { child: { string?: string } } = { child: {} };
    addMessageDefaults(datatypes, "root", message);
    expect(message.child.string).toEqual("");
  });

  it("recursively sets fields in complex array types", () => {
    const datatypes = {
      root: { fields: [{ type: "child", name: "child", isComplex: true, isArray: true }] },
      child: { fields: [{ type: "string", name: "string" }] },
    };
    const message: { child: { string?: string }[] } = { child: [{}] };
    addMessageDefaults(datatypes, "root", message);
    expect(message.child[0]?.string).toEqual("");
  });

  it("sets missing empty arrays", () => {
    const datatypes = {
      root: { fields: [{ type: "string", name: "child", isArray: true }] },
    };
    const message: { child?: unknown } = {};
    addMessageDefaults(datatypes, "root", message);
    expect(message.child).toEqual([]);
  });

  it("sets undefined fields in array types", () => {
    const datatypes = {
      root: { fields: [{ type: "string", name: "child", isArray: true }] },
    };
    const message = { child: [undefined] };
    addMessageDefaults(datatypes, "root", message);
    expect(message.child).toEqual([""]);
  });

  it("sets a complex object when it is not present", () => {
    const datatypes = {
      root: { fields: [{ type: "child", name: "child", isComplex: true }] },
      child: { fields: [{ type: "string", name: "string" }] },
    };
    const message: { child?: { string?: string } } = {};
    addMessageDefaults(datatypes, "root", message);
    expect(message.child?.string).toEqual("");
  });
});
