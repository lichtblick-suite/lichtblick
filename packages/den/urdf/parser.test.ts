/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseUrdf } from "./parser";

describe("parseUrdf", () => {
  it("parses pose with arbitrary whitespace", () => {
    expect(
      parseUrdf(/* xml */ `<?xml version="1.0" ?>
    <robot name="X">
      <link name="x">
        <visual name="y">
          <origin xyz="0     0    -0.135" rpy="0   0   1.57"/>
          <geometry>
            <box size="1 2 3"/>
          </geometry>
        </visual>
      </link>
    </robot>
`),
    ).toMatchInlineSnapshot(`
      {
        "joints": Map {},
        "links": Map {
          "x" => {
            "colliders": [],
            "name": "x",
            "visuals": [
              {
                "geometry": {
                  "geometryType": "box",
                  "size": {
                    "x": 1,
                    "y": 2,
                    "z": 3,
                  },
                },
                "material": undefined,
                "name": "y",
                "origin": {
                  "rpy": {
                    "x": 0,
                    "y": 0,
                    "z": 1.57,
                  },
                  "xyz": {
                    "x": 0,
                    "y": 0,
                    "z": -0.135,
                  },
                },
              },
            ],
          },
        },
        "materials": Map {},
        "name": "X",
      }
    `);
  });
});
