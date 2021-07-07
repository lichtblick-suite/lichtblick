// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import getPrettifiedCode from "./getPrettifiedCode";

describe("getPrettifiedCode", () => {
  it("formats valid Typescript code", async () => {
    const unformattedValidCode = `
      import { Input,   Messages  } from "ros";;
      const VALUE =
      "val";
      const publisher = (message: Input< "/foo/bar">
      ): Messages.visualization_msgs__StudioMarkerArray | undefined => {
        return { VALUE
        }}
    `;
    const formattedCode = await getPrettifiedCode(unformattedValidCode);
    expect(formattedCode).toMatchSnapshot();
  });

  it("throws an error for invalid code", async () => {
    const unformattedInvalidCode = `
      import { Input,  from "ros"; // Missing closing curly
      const publisher = (): => { // Missing type
        return;
      }
    `;
    await expect(getPrettifiedCode(unformattedInvalidCode)).rejects.not.toBeFalsy();
  });
});
