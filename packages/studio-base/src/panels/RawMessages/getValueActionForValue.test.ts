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

import { MessagePathStructureItem } from "@foxglove/studio-base/components/MessagePathSyntax/constants";

import { getValueActionForValue, getStructureItemForPath } from "./getValueActionForValue";

describe("getValueActionForValue", () => {
  it("returns undefined if it is not a primitive", () => {
    const structureItem: MessagePathStructureItem = {
      structureType: "message",
      nextByName: {},
      datatype: "",
    };
    expect(getValueActionForValue({}, structureItem, [])).toEqual(undefined);
  });

  it("returns paths for an id inside an array", () => {
    const structureItem: MessagePathStructureItem = {
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
    expect(getValueActionForValue([{ some_id: 123 }], structureItem, [0, "some_id"])).toEqual({
      filterPath: "[:]{some_id==123}",
      multiSlicePath: "[:].some_id",
      primitiveType: "uint32",
      singleSlicePath: "[:]{some_id==123}.some_id",
    });
  });

  it("returns paths with bigints", () => {
    const structureItem: MessagePathStructureItem = {
      structureType: "array",
      next: {
        structureType: "message",
        nextByName: {
          some_id: {
            structureType: "primitive",
            primitiveType: "uint64",
            datatype: "",
          },
        },
        datatype: "",
      },
      datatype: "",
    };
    expect(
      getValueActionForValue([{ some_id: 18446744073709552000n }], structureItem, [0, "some_id"]),
    ).toEqual({
      filterPath: "[:]{some_id==18446744073709552000}",
      multiSlicePath: "[:].some_id",
      primitiveType: "uint64",
      singleSlicePath: "[:]{some_id==18446744073709552000}.some_id",
    });
  });

  it("does not crash with bigints nested inside arrays under isTypicalFilterName key (id)", () => {
    const structureItem: MessagePathStructureItem = {
      structureType: "array",
      next: {
        structureType: "message",
        nextByName: {
          some_id: {
            structureType: "message",
            datatype: "",
            nextByName: {
              x: {
                structureType: "primitive",
                primitiveType: "uint64",
                datatype: "",
              },
            },
          },
        },
        datatype: "",
      },
      datatype: "",
    };
    expect(
      getValueActionForValue([{ some_id: { x: 18446744073709552000n } }], structureItem, [
        0,
        "some_id",
      ]),
    ).toEqual(undefined);
  });

  it("returns paths with bigints inside object inside array", () => {
    const structureItem: MessagePathStructureItem = {
      structureType: "message",
      nextByName: {
        msg1: {
          structureType: "array",
          next: {
            structureType: "message",
            nextByName: {
              msg2: {
                structureType: "message",
                datatype: "",
                nextByName: {
                  msg3: {
                    datatype: "",
                    structureType: "primitive",
                    primitiveType: "int64",
                  },
                },
              },
            },
            datatype: "",
          },
          datatype: "",
        },
      },
      datatype: "",
    };

    expect(
      getValueActionForValue({ msg1: [{ msg2: { msg3: 1234n } }] }, structureItem, [
        "msg1",
        0,
        "msg2",
        "msg3",
      ]),
    ).toEqual({
      filterPath: "",
      multiSlicePath: ".msg1[:].msg2.msg3",
      primitiveType: "int64",
      singleSlicePath: ".msg1[0].msg2.msg3",
    });
  });

  it("returns slice paths when pointing at a number (even when it looks like an id)", () => {
    const structureItem: MessagePathStructureItem = {
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
    expect(getValueActionForValue({ some_id: 123 }, structureItem, ["some_id"])).toEqual({
      filterPath: "",
      singleSlicePath: ".some_id",
      multiSlicePath: ".some_id",
      primitiveType: "uint32",
    });
  });

  it("returns different single/multi slice paths when pointing at a value inside an array (not an id)", () => {
    const structureItem: MessagePathStructureItem = {
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
    expect(getValueActionForValue([{ some_value: 456 }], structureItem, [0, "some_value"])).toEqual(
      {
        filterPath: "[:]{some_value==456}",
        singleSlicePath: "[0].some_value",
        multiSlicePath: "[:].some_value",
        primitiveType: "uint32",
      },
    );
  });

  it("uses an id for the `singleSlicePath` if one is available next to the value", () => {
    const structureItem: MessagePathStructureItem = {
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
      getValueActionForValue([{ some_id: 123, some_value: 456 }], structureItem, [0, "some_value"]),
    ).toEqual({
      filterPath: "[:]{some_value==456}",
      singleSlicePath: "[:]{some_id==123}.some_value",
      multiSlicePath: "[:].some_value",
      primitiveType: "uint32",
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
    const rootStructureItem: MessagePathStructureItem = {
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
    expect(getValueActionForValue(rootValue, rootStructureItem, ["status", 0, "level"])).toEqual({
      filterPath: ".status[:]{level==0}",
      singleSlicePath: '.status[:]{node_id=="/my_node"}.level',
      multiSlicePath: ".status[:].level",
      primitiveType: "int8",
    });
  });
});

describe("getStructureItemForPath", () => {
  it("returns a structureItem for an array element", () => {
    const structureItem: MessagePathStructureItem = {
      structureType: "array",
      next: {
        structureType: "primitive",
        primitiveType: "uint32",
        datatype: "",
      },
      datatype: "",
    };
    expect(getStructureItemForPath(structureItem, [0])).toEqual({
      structureType: "primitive",
      primitiveType: "uint32",
      datatype: "",
    });
  });

  it("returns a structureItem for a map element", () => {
    const structureItem: MessagePathStructureItem = {
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
    expect(getStructureItemForPath(structureItem, ["some_id"])).toEqual({
      structureType: "primitive",
      primitiveType: "uint32",
      datatype: "",
    });
  });

  it("returns a structureItem multi elements path", () => {
    const structureItem: MessagePathStructureItem = {
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
    expect(getStructureItemForPath(structureItem, [0, "some_id"])).toEqual({
      structureType: "primitive",
      primitiveType: "uint32",
      datatype: "",
    });
  });

  it("returns a key named '0'", () => {
    const structureItem: MessagePathStructureItem = {
      structureType: "message",
      nextByName: {
        0: {
          structureType: "primitive",
          primitiveType: "uint32",
          datatype: "",
        },
      },
      datatype: "",
    };
    expect(getStructureItemForPath(structureItem, ["0"])).toEqual({
      structureType: "primitive",
      primitiveType: "uint32",
      datatype: "",
    });
  });
});
