/** @jest-environment jsdom */
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

import { tryToSetDefaultGlobalVar, getFirstInvalidVariableFromRosPath } from "./MessagePathInput";
import { RosPath } from "./constants";

describe("tryToSetDefaultGlobalVar", () => {
  it("correctly returns true/false depending on whether a global variable has a default", () => {
    const setGlobalVars = jest.fn();
    expect(tryToSetDefaultGlobalVar("some_var_without_default", setGlobalVars)).toEqual(false);
    expect(setGlobalVars).not.toHaveBeenCalled();
  });
});

describe("getFirstInvalidVariableFromRosPath", () => {
  it("returns all possible message paths when not passing in `validTypes`", () => {
    const setGlobalVars = jest.fn();
    const rosPath: RosPath = {
      topicName: "/some_topic",
      topicNameRepr: "/some_topic",
      messagePath: [
        { type: "name", name: "fieldName", repr: "fieldName" },
        { type: "slice", start: 0, end: Infinity },
        {
          type: "filter",
          path: ["myId"],
          value: { variableName: "not_yet_set_global_var", startLoc: 10 },
          nameLoc: 11,
          valueLoc: 10,
          repr: "myId==$not_yet_set_global_var",
        },
      ],
      modifier: undefined,
    };
    expect(getFirstInvalidVariableFromRosPath(rosPath, {}, setGlobalVars)).toEqual({
      loc: 10,
      variableName: "not_yet_set_global_var",
    });
    expect(setGlobalVars).not.toHaveBeenCalled();

    expect(
      getFirstInvalidVariableFromRosPath(rosPath, { not_yet_set_global_var: 5 }, setGlobalVars),
    ).toEqual(undefined);
    expect(setGlobalVars).not.toHaveBeenCalled();
  });
});
