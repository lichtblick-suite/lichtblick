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

import { uniqBy } from "lodash";

import {
  VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
  VISUALIZATION_MSGS_MARKER_DATATYPE,
} from "@foxglove/studio-base/util/globalConstants";

import { basicDatatypes } from "./datatypes";
import rosDatatypesToMessageDefinition from "./rosDatatypesToMessageDefinition";

describe("rosDatatypesToMessageDefinition", () => {
  it(`Includes all of the definitions for "visualization_msgs/StudioMarkerArray"`, () => {
    expect(
      rosDatatypesToMessageDefinition(basicDatatypes, VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE),
    ).toMatchSnapshot();
  });

  it("produces a correct message definition", () => {
    const definitions = rosDatatypesToMessageDefinition(
      basicDatatypes,
      VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
    );
    // Should have 1 definition without a name, the root datatype.
    expect(definitions.filter(({ name }) => name == undefined).length).toEqual(1);
    // Should not duplicate definitions.
    expect(uniqBy(definitions, "name").length).toEqual(definitions.length);
  });

  it("Errors if it can't find the definition", () => {
    const datatypes = {
      [VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE]: {
        fields: [
          {
            isArray: true,
            isComplex: true,
            arrayLength: undefined,
            name: "markers",
            type: VISUALIZATION_MSGS_MARKER_DATATYPE,
          },
          {
            isArray: false,
            isComplex: true,
            name: "header",
            type: "std_msgs/CustomHeader",
          },
        ],
      },
    };
    expect(() =>
      rosDatatypesToMessageDefinition(datatypes, VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE),
    ).toThrow(
      `While searching datatypes for "${VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE}", could not find datatype "std_msgs/CustomHeader"`,
    );
  });
});
