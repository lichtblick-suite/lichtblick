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

import { unwrap } from "@foxglove/den/monads";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import {
  traverseStructure,
  messagePathsForStructure,
  messagePathStructures,
  validTerminatingStructureItem,
} from "./messagePathsForDatatype";

const datatypes: RosDatatypes = new Map(
  Object.entries({
    "pose_msgs/PoseDebug": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isArray: false },
        { name: "some_pose", type: "pose_msgs/SomePose", isArray: false },
      ],
    },
    "pose_msgs/SomePose": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isArray: false },
        { name: "x", type: "float64", isArray: false },
        { name: "SOME_CONSTANT", type: "float64", isArray: false, isConstant: true, value: 10 }, // Should be ignored.
        { name: "dummy_array", type: "float64", isArray: true },
      ],
    },
    "std_msgs/Header": {
      definitions: [
        { name: "seq", type: "uint32", isArray: false },
        { name: "stamp", type: "time", isArray: false },
        { name: "frame_id", type: "string", isArray: false },
      ],
    },
    "msgs/Log": {
      definitions: [{ name: "id", type: "int32", isArray: false }],
    },
    "geometry_msgs/Transform": {
      definitions: [
        { name: "rotation", type: "float64", isArray: false },
        { name: "translation", type: "float64", isArray: false },
      ],
    },
    "geometry_msgs/TransformStamped": {
      definitions: [
        { name: "child_frame_id", type: "string", isArray: false },
        { name: "header", type: "std_msgs/Header", isArray: false },
        { name: "transform", type: "geometry_msgs/Transform", isArray: false },
      ],
    },
    "tf/tfMessage": {
      definitions: [{ name: "transforms", type: "geometry_msgs/TransformStamped", isArray: true }],
    },
    "visualization_msgs/Marker": {
      definitions: [{ name: "id", type: "int32", isArray: false }],
    },
    "visualization_msgs/MarkerArray": {
      definitions: [{ name: "markers", type: "visualization_msgs/Marker", isArray: true }],
    },
  }),
);

describe("messagePathStructures", () => {
  it("parses datatypes into a flat structure", () => {
    expect(messagePathStructures(datatypes)).toEqual({
      "geometry_msgs/Transform": {
        datatype: "geometry_msgs/Transform",
        nextByName: {
          rotation: {
            datatype: "geometry_msgs/Transform",
            primitiveType: "float64",
            structureType: "primitive",
          },
          translation: {
            datatype: "geometry_msgs/Transform",
            primitiveType: "float64",
            structureType: "primitive",
          },
        },
        structureType: "message",
      },
      "geometry_msgs/TransformStamped": {
        datatype: "geometry_msgs/TransformStamped",
        nextByName: {
          child_frame_id: {
            datatype: "geometry_msgs/TransformStamped",
            primitiveType: "string",
            structureType: "primitive",
          },
          header: {
            datatype: "std_msgs/Header",
            nextByName: {
              frame_id: {
                datatype: "std_msgs/Header",
                primitiveType: "string",
                structureType: "primitive",
              },
              seq: {
                datatype: "std_msgs/Header",
                primitiveType: "uint32",
                structureType: "primitive",
              },
              stamp: {
                datatype: "time",
                nextByName: {
                  nsec: {
                    datatype: "",
                    primitiveType: "uint32",
                    structureType: "primitive",
                  },
                  sec: {
                    datatype: "",
                    primitiveType: "uint32",
                    structureType: "primitive",
                  },
                },
                structureType: "message",
              },
            },
            structureType: "message",
          },
          transform: {
            datatype: "geometry_msgs/Transform",
            nextByName: {
              rotation: {
                datatype: "geometry_msgs/Transform",
                primitiveType: "float64",
                structureType: "primitive",
              },
              translation: {
                datatype: "geometry_msgs/Transform",
                primitiveType: "float64",
                structureType: "primitive",
              },
            },
            structureType: "message",
          },
        },
        structureType: "message",
      },
      "pose_msgs/SomePose": {
        nextByName: {
          dummy_array: {
            next: {
              primitiveType: "float64",
              structureType: "primitive",
              datatype: "pose_msgs/SomePose",
            },
            structureType: "array",
            datatype: "pose_msgs/SomePose",
          },
          header: {
            nextByName: {
              frame_id: {
                primitiveType: "string",
                structureType: "primitive",
                datatype: "std_msgs/Header",
              },
              seq: {
                primitiveType: "uint32",
                structureType: "primitive",
                datatype: "std_msgs/Header",
              },
              stamp: {
                structureType: "message",
                nextByName: {
                  sec: { primitiveType: "uint32", structureType: "primitive", datatype: "" },
                  nsec: { primitiveType: "uint32", structureType: "primitive", datatype: "" },
                },
                datatype: "time",
              },
            },
            structureType: "message",
            datatype: "std_msgs/Header",
          },
          x: {
            primitiveType: "float64",
            structureType: "primitive",
            datatype: "pose_msgs/SomePose",
          },
        },
        structureType: "message",
        datatype: "pose_msgs/SomePose",
      },
      "pose_msgs/PoseDebug": {
        nextByName: {
          header: {
            nextByName: {
              frame_id: {
                primitiveType: "string",
                structureType: "primitive",
                datatype: "std_msgs/Header",
              },
              seq: {
                primitiveType: "uint32",
                structureType: "primitive",
                datatype: "std_msgs/Header",
              },
              stamp: {
                structureType: "message",
                nextByName: {
                  sec: { primitiveType: "uint32", structureType: "primitive", datatype: "" },
                  nsec: { primitiveType: "uint32", structureType: "primitive", datatype: "" },
                },
                datatype: "time",
              },
            },
            structureType: "message",
            datatype: "std_msgs/Header",
          },
          some_pose: {
            nextByName: {
              dummy_array: {
                next: {
                  primitiveType: "float64",
                  structureType: "primitive",
                  datatype: "pose_msgs/SomePose",
                },
                structureType: "array",
                datatype: "pose_msgs/SomePose",
              },
              header: {
                nextByName: {
                  frame_id: {
                    primitiveType: "string",
                    structureType: "primitive",
                    datatype: "std_msgs/Header",
                  },
                  seq: {
                    primitiveType: "uint32",
                    structureType: "primitive",
                    datatype: "std_msgs/Header",
                  },
                  stamp: {
                    structureType: "message",
                    nextByName: {
                      sec: { primitiveType: "uint32", structureType: "primitive", datatype: "" },
                      nsec: { primitiveType: "uint32", structureType: "primitive", datatype: "" },
                    },
                    datatype: "time",
                  },
                },
                structureType: "message",
                datatype: "std_msgs/Header",
              },
              x: {
                primitiveType: "float64",
                structureType: "primitive",
                datatype: "pose_msgs/SomePose",
              },
            },
            structureType: "message",
            datatype: "pose_msgs/SomePose",
          },
        },
        structureType: "message",
        datatype: "pose_msgs/PoseDebug",
      },
      "std_msgs/Header": {
        nextByName: {
          frame_id: {
            primitiveType: "string",
            structureType: "primitive",
            datatype: "std_msgs/Header",
          },
          seq: { primitiveType: "uint32", structureType: "primitive", datatype: "std_msgs/Header" },
          stamp: {
            structureType: "message",
            nextByName: {
              sec: { primitiveType: "uint32", structureType: "primitive", datatype: "" },
              nsec: { primitiveType: "uint32", structureType: "primitive", datatype: "" },
            },
            datatype: "time",
          },
        },
        structureType: "message",
        datatype: "std_msgs/Header",
      },
      "msgs/Log": {
        nextByName: {
          id: { primitiveType: "int32", structureType: "primitive", datatype: "msgs/Log" },
        },
        structureType: "message",
        datatype: "msgs/Log",
      },
      "tf/tfMessage": {
        datatype: "tf/tfMessage",
        nextByName: {
          transforms: {
            datatype: "tf/tfMessage",
            next: {
              datatype: "geometry_msgs/TransformStamped",
              nextByName: {
                child_frame_id: {
                  datatype: "geometry_msgs/TransformStamped",
                  primitiveType: "string",
                  structureType: "primitive",
                },
                header: {
                  datatype: "std_msgs/Header",
                  nextByName: {
                    frame_id: {
                      datatype: "std_msgs/Header",
                      primitiveType: "string",
                      structureType: "primitive",
                    },
                    seq: {
                      datatype: "std_msgs/Header",
                      primitiveType: "uint32",
                      structureType: "primitive",
                    },
                    stamp: {
                      datatype: "time",
                      nextByName: {
                        nsec: {
                          datatype: "",
                          primitiveType: "uint32",
                          structureType: "primitive",
                        },
                        sec: {
                          datatype: "",
                          primitiveType: "uint32",
                          structureType: "primitive",
                        },
                      },
                      structureType: "message",
                    },
                  },
                  structureType: "message",
                },
                transform: {
                  datatype: "geometry_msgs/Transform",
                  nextByName: {
                    rotation: {
                      datatype: "geometry_msgs/Transform",
                      primitiveType: "float64",
                      structureType: "primitive",
                    },
                    translation: {
                      datatype: "geometry_msgs/Transform",
                      primitiveType: "float64",
                      structureType: "primitive",
                    },
                  },
                  structureType: "message",
                },
              },
              structureType: "message",
            },
            structureType: "array",
          },
        },
        structureType: "message",
      },
      "visualization_msgs/Marker": {
        datatype: "visualization_msgs/Marker",
        nextByName: {
          id: {
            datatype: "visualization_msgs/Marker",
            primitiveType: "int32",
            structureType: "primitive",
          },
        },
        structureType: "message",
      },
      "visualization_msgs/MarkerArray": {
        datatype: "visualization_msgs/MarkerArray",
        nextByName: {
          markers: {
            datatype: "visualization_msgs/MarkerArray",
            next: {
              datatype: "visualization_msgs/Marker",
              nextByName: {
                id: {
                  datatype: "visualization_msgs/Marker",
                  primitiveType: "int32",
                  structureType: "primitive",
                },
              },
              structureType: "message",
            },
            structureType: "array",
          },
        },
        structureType: "message",
      },
    });
  });

  it("supports types which reference themselves", () => {
    const selfReferencingDatatypes: RosDatatypes = new Map(
      Object.entries({
        "some.type": {
          definitions: [{ name: "foo", type: "some.type" }],
        },
      }),
    );

    expect(messagePathStructures(selfReferencingDatatypes)).toEqual({
      "some.type": {
        datatype: "some.type",
        nextByName: {
          foo: {
            datatype: "some.type",
            nextByName: {},
            structureType: "message",
          },
        },
        structureType: "message",
      },
    });
  });
});

describe("messagePathsForStructure", () => {
  const structures = messagePathStructures(datatypes);

  it("returns all possible message paths when not passing in `validTypes`", () => {
    expect(messagePathsForStructure(unwrap(structures["pose_msgs/PoseDebug"]))).toEqual([
      "",
      ".header",
      ".header.frame_id",
      ".header.seq",
      ".header.stamp",
      ".header.stamp.nsec",
      ".header.stamp.sec",
      ".some_pose",
      ".some_pose.dummy_array",
      ".some_pose.dummy_array[:]",
      ".some_pose.header",
      ".some_pose.header.frame_id",
      ".some_pose.header.seq",
      ".some_pose.header.stamp",
      ".some_pose.header.stamp.nsec",
      ".some_pose.header.stamp.sec",
      ".some_pose.x",
    ]);
    expect(messagePathsForStructure(unwrap(structures["msgs/Log"]))).toEqual(["", ".id"]);

    expect(messagePathsForStructure(unwrap(structures["tf/tfMessage"]))).toEqual([
      "",
      ".transforms",
      ".transforms[0]",
      ".transforms[0].child_frame_id",
      ".transforms[0].header",
      ".transforms[0].header.frame_id",
      ".transforms[0].header.seq",
      ".transforms[0].header.stamp",
      ".transforms[0].header.stamp.nsec",
      ".transforms[0].header.stamp.sec",
      ".transforms[0].transform",
      ".transforms[0].transform.rotation",
      ".transforms[0].transform.translation",
    ]);

    expect(messagePathsForStructure(unwrap(structures["visualization_msgs/MarkerArray"]))).toEqual([
      "",
      ".markers",
      ".markers[:]{id==0}",
      ".markers[:]{id==0}.id",
    ]);
  });

  it("returns an array of possible message paths for the given `validTypes`", () => {
    expect(
      messagePathsForStructure(unwrap(structures["pose_msgs/PoseDebug"]), {
        validTypes: ["float64"],
      }),
    ).toEqual([".some_pose.dummy_array[:]", ".some_pose.x"]);
  });

  it("does not suggest hashes with multiple values when setting `noMultiSlices`", () => {
    expect(
      messagePathsForStructure(unwrap(structures["pose_msgs/PoseDebug"]), {
        validTypes: ["float64"],
        noMultiSlices: true,
      }),
    ).toEqual([".some_pose.dummy_array[0]", ".some_pose.x"]);
  });
});

describe("validTerminatingStructureItem", () => {
  it("is invalid for empty structureItem", () => {
    expect(validTerminatingStructureItem()).toEqual(false);
  });

  it("works for structureType", () => {
    expect(
      validTerminatingStructureItem({ structureType: "message", nextByName: {}, datatype: "" }),
    ).toEqual(true);
    expect(
      validTerminatingStructureItem({ structureType: "message", nextByName: {}, datatype: "" }, [
        "message",
      ]),
    ).toEqual(true);
    expect(
      validTerminatingStructureItem({ structureType: "message", nextByName: {}, datatype: "" }, [
        "array",
      ]),
    ).toEqual(false);
  });

  // time and duration are special sturctures. Even tho they are technically a _message_ structure type
  // we support using them as a terminating sturcture item since they can also be represented as a single value
  it("works for time and duration", () => {
    expect(
      validTerminatingStructureItem(
        { structureType: "message", nextByName: {}, datatype: "time" },
        ["time"],
      ),
    ).toEqual(true);

    expect(
      validTerminatingStructureItem(
        { structureType: "message", nextByName: {}, datatype: "duration" },
        ["duration"],
      ),
    ).toEqual(true);
  });

  it("works for primitiveType", () => {
    expect(
      validTerminatingStructureItem(
        { structureType: "primitive", primitiveType: "uint32", datatype: "" },
        ["uint32"],
      ),
    ).toEqual(true);
  });
});

describe("traverseStructure", () => {
  it("returns whether the path is valid for the structure, plus some metadata", () => {
    const structure = messagePathStructures(datatypes)["pose_msgs/PoseDebug"];

    // Valid:
    expect(
      traverseStructure(structure, [
        { type: "name", name: "some_pose", repr: "some_pose" },
        { type: "name", name: "x", repr: "x" },
      ]),
    ).toEqual({
      valid: true,
      msgPathPart: undefined,
      structureItem: (structure?.nextByName.some_pose as any).nextByName.x,
    });
    expect(
      traverseStructure(structure, [
        { type: "name", name: "some_pose", repr: "some_pose" },
        { type: "name", name: "dummy_array", repr: "dummy_array" },
        { type: "slice", start: 50, end: 100 },
      ]),
    ).toEqual({
      valid: true,
      msgPathPart: undefined,
      structureItem: (structure?.nextByName.some_pose as any).nextByName.dummy_array.next,
    });
    expect(
      traverseStructure(structure, [
        { type: "name", name: "some_pose", repr: "some_pose" },
        { type: "filter", path: ["x"], value: 10, nameLoc: 123, valueLoc: 0, repr: "" },
        { type: "name", name: "dummy_array", repr: "dummy_array" },
        { type: "slice", start: 50, end: 100 },
      ]),
    ).toEqual({
      valid: true,
      msgPathPart: undefined,
      structureItem: (structure?.nextByName.some_pose as any).nextByName.dummy_array.next,
    });
    expect(
      traverseStructure(structure, [
        { type: "name", name: "some_pose", repr: "some_pose" },
        { type: "filter", path: ["header", "seq"], value: 10, nameLoc: 123, valueLoc: 0, repr: "" },
      ]),
    ).toEqual({
      valid: true,
      msgPathPart: undefined,
      structureItem: structure?.nextByName.some_pose,
    });
    expect(
      traverseStructure(structure, [{ type: "name", name: "some_pose", repr: "some_pose" }]),
    ).toEqual({
      valid: true,
      msgPathPart: undefined,
      structureItem: structure?.nextByName.some_pose,
    });

    expect(
      traverseStructure(structure, [
        { type: "name", name: "header", repr: "header" },
        { type: "name", name: "stamp", repr: "stamp" },
        { type: "name", name: "sec", repr: "sec" },
      ]),
    ).toEqual({
      valid: true,
      msgPathPart: undefined,
      structureItem: {
        datatype: "",
        primitiveType: "uint32",
        structureType: "primitive",
      },
    });

    // Invalid:
    expect(
      traverseStructure(structure, [
        { type: "name", name: "some_pose", repr: "some_pose" },
        { type: "filter", path: ["y"], value: 10, nameLoc: 123, valueLoc: 0, repr: "" },
      ]),
    ).toEqual({
      valid: false,
      msgPathPart: { type: "filter", path: ["y"], value: 10, nameLoc: 123, valueLoc: 0, repr: "" },
      structureItem: messagePathStructures(datatypes)["pose_msgs/SomePose"],
    });
    expect(
      traverseStructure(structure, [
        { type: "name", name: "some_pose", repr: "some_pose" },
        { type: "filter", path: ["header", "y"], value: 10, nameLoc: 123, valueLoc: 0, repr: "" },
      ]),
    ).toEqual({
      valid: false,
      msgPathPart: {
        type: "filter",
        path: ["header", "y"],
        value: 10,
        nameLoc: 123,
        valueLoc: 0,
        repr: "",
      },
      structureItem: messagePathStructures(datatypes)["pose_msgs/SomePose"],
    });
  });
});
