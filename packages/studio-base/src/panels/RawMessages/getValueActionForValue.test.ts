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

import { getValueActionForValue, getStructureItemForPath } from "./getValueActionForValue";

describe("getValueActionForValue", () => {
  const getAction = (data: any, structureItem: any, keyPath: any) => {
    const value = data;
    return getValueActionForValue(value, structureItem, keyPath);
  };

  it("returns undefined if it is not a primitive", () => {
    const structureItem = {
      structureType: "message",
      nextByName: {},
      datatype: "",
    };
    expect(getAction({}, structureItem, [])).toEqual(undefined);
  });

  it("returns paths for an id inside an array", () => {
    const structureItem = {
      structureType: "array",
      next: {
        structureType: "message",
        nextByName: {
          some_id: {
            structureType: "primitive",
            primitiveType: "uint32",
            datatype: "",
          },
        },
        datatype: "",
      },
      datatype: "",
    };
    expect(getAction([{ some_id: 123 }], structureItem, [0, "some_id"])).toEqual({
      filterPath: "[:]{some_id==123}",
      multiSlicePath: "[:].some_id",
      primitiveType: "uint32",
      singleSlicePath: "[:]{some_id==123}.some_id",
    });
  });

  it("returns slice paths when pointing at a number (even when it looks like an id)", () => {
    const structureItem = {
      structureType: "message",
      nextByName: {
        some_id: {
          structureType: "primitive",
          primitiveType: "uint32",
          datatype: "",
        },
      },
      datatype: "",
    };
    expect(getAction({ some_id: 123 }, structureItem, ["some_id"])).toEqual({
      filterPath: "",
      singleSlicePath: ".some_id",
      multiSlicePath: ".some_id",
      primitiveType: "uint32",
    });
  });

  it("returns different single/multi slice paths when pointing at a value inside an array (not an id)", () => {
    const structureItem = {
      structureType: "array",
      next: {
        structureType: "message",
        nextByName: {
          some_value: {
            structureType: "primitive",
            primitiveType: "uint32",
            datatype: "",
          },
        },
        datatype: "",
      },
      datatype: "",
    };
    expect(getAction([{ some_value: 456 }], structureItem, [0, "some_value"])).toEqual({
      filterPath: "[:]{some_value==456}",
      singleSlicePath: "[0].some_value",
      multiSlicePath: "[:].some_value",
      primitiveType: "uint32",
    });
  });

  it("uses an id for the `singleSlicePath` if one is available next to the value", () => {
    const structureItem = {
      structureType: "array",
      next: {
        structureType: "message",
        nextByName: {
          some_id: {
            structureType: "primitive",
            primitiveType: "uint32",
            datatype: "",
          },
          some_value: {
            structureType: "primitive",
            primitiveType: "uint32",
            datatype: "",
          },
        },
        datatype: "",
      },
      datatype: "",
    };
    expect(
      getAction([{ some_id: 123, some_value: 456 }], structureItem, [0, "some_value"]),
    ).toEqual({
      filterPath: "[:]{some_value==456}",
      singleSlicePath: "[:]{some_id==123}.some_value",
      multiSlicePath: "[:].some_value",
      primitiveType: "uint32",
    });
  });

  it("returns value when looking inside a 'json' primitive", () => {
    const structureItem = { structureType: "primitive", primitiveType: "json", datatype: "" };
    expect(getAction({ abc: 0, def: 0 }, structureItem, ["abc"])).toEqual({
      filterPath: "",
      multiSlicePath: ".abc",
      primitiveType: "json",
      singleSlicePath: ".abc",
    });
  });

  it("returns single/multi slice paths when pointing at a value inside an array, nested inside a JSON field", () => {
    const structureItem = {
      structureType: "array",
      next: {
        structureType: "message",
        nextByName: {
          outer_key: { structureType: "primitive", primitiveType: "json", datatype: "" },
        },
        datatype: "",
      },
      datatype: "",
    };
    expect(
      getAction([{ outer_key: { nested_key: 456 } }], structureItem, [
        0,
        "outer_key",
        "nested_key",
      ]),
    ).toEqual({
      filterPath: "",
      singleSlicePath: "[0].outer_key.nested_key",
      multiSlicePath: "[:].outer_key.nested_key",
      primitiveType: "json",
    });
  });

  it("returns undefined when trying to look inside a 'time'", () => {
    const structureItem = {
      structureType: "primitive",
      primitiveType: "time",
      datatype: "",
    };
    expect(getAction({ sec: 0, nsec: 0 }, structureItem, ["sec"])).toEqual(undefined);
  });

  it("returns slice paths for json", () => {
    const structureItem = {
      structureType: "message",
      nextByName: {
        some_id: {
          structureType: "primitive",
          primitiveType: "json",
          datatype: "",
        },
      },
      datatype: "",
    };
    expect(getAction({ some_id: 123 }, structureItem, ["some_id"])).toEqual({
      filterPath: "",
      singleSlicePath: ".some_id",
      multiSlicePath: ".some_id",
      primitiveType: "json",
    });
  });

  it(`wraps string path filters with ""`, () => {
    const rootValue = {
      status: [
        {
          level: 0,
          node_id: "/my_node",
        },
      ],
    };
    const rootStructureItem = {
      structureType: "message",
      nextByName: {
        status: {
          structureType: "array",
          next: {
            structureType: "message",
            nextByName: {
              level: {
                structureType: "primitive",
                primitiveType: "int8",
                datatype: "msgs/node",
              },
              node_id: {
                structureType: "primitive",
                primitiveType: "string",
                datatype: "msgs/node",
              },
            },
            datatype: "msgs/node",
          },
          datatype: "msgs/nodeArray",
        },
      },
      datatype: "msgs/nodeArray",
    };
    expect(getAction(rootValue, rootStructureItem, ["status", 0, "level"])).toEqual({
      filterPath: ".status[:]{level==0}",
      singleSlicePath: '.status[:]{node_id=="/my_node"}.level',
      multiSlicePath: ".status[:].level",
      primitiveType: "int8",
    });
  });
});

describe("getStructureItemForPath", () => {
  it("returns a structureItem for an array element", () => {
    const structureItem = {
      structureType: "array",
      next: {
        structureType: "primitive",
        primitiveType: "uint32",
        datatype: "",
      },
    };
    expect(getStructureItemForPath(structureItem as any, "0")).toEqual({
      structureType: "primitive",
      primitiveType: "uint32",
      datatype: "",
    });
  });

  it("returns a structureItem for a map element", () => {
    const structureItem = {
      structureType: "message",
      nextByName: {
        some_id: {
          structureType: "primitive",
          primitiveType: "uint32",
          datatype: "",
        },
      },
      datatype: "",
    };
    expect(getStructureItemForPath(structureItem as any, "some_id")).toEqual({
      structureType: "primitive",
      primitiveType: "uint32",
      datatype: "",
    });
  });

  it("returns a structureItem multi elements path", () => {
    const structureItem = {
      structureType: "array",
      next: {
        structureType: "message",
        nextByName: {
          some_id: {
            structureType: "primitive",
            primitiveType: "uint32",
            datatype: "",
          },
        },
        datatype: "",
      },
      datatype: "",
    };
    expect(getStructureItemForPath(structureItem as any, "0,some_id")).toEqual({
      structureType: "primitive",
      primitiveType: "uint32",
      datatype: "",
    });
  });
});
