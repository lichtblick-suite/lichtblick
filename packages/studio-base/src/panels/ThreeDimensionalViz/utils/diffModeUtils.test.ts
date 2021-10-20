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

import { Interactive } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";

import {
  getDiffBySource,
  BASE_COLOR,
  SOURCE_1_COLOR,
  SOURCE_2_COLOR,
  BASE_COLOR_RGBA,
  SOURCE_1_COLOR_RGBA,
  SOURCE_2_COLOR_RGBA,
} from "./diffModeUtils";

const marker = (topic: string): Interactive<any> => {
  return {
    id: "foo",
    ns: "bar",
    interactionData: {
      topic,
      originalMessage: {},
    },
  };
};

const markers = {
  arrow: [marker("arrows")],
  color: [],
  cube: [],
  cubeList: [],
  cylinder: [],
  glText: [],
  grid: [],
  instancedLineList: [],
  laserScan: [],
  linedConvexHull: [],
  lineList: [marker("foo"), marker(`${SECOND_SOURCE_PREFIX}/foo`)],
  lineStrip: [],
  mesh: [],
  pointcloud: [marker(`${SECOND_SOURCE_PREFIX}/foo`)],
  points: [],
  poseMarker: [],
  sphere: [],
  sphereList: [],
  text: [],
  triangleList: [],
};

const sharedExpected = {
  arrow: [],
  color: [],
  cube: [],
  cubeList: [],
  cylinder: [],
  glText: [],
  grid: [],
  instancedLineList: [],
  laserScan: [],
  linedConvexHull: [],
  lineList: [],
  lineStrip: [],
  mesh: [],
  pointcloud: [],
  points: [],
  poseMarker: [],
  sphere: [],
  sphereList: [],
  text: [],
  triangleList: [],
};

describe("getDiffBySource", () => {
  it("generate three render passes with markers from both sources", () => {
    const passes = getDiffBySource(markers);
    expect(passes.length).toBe(3);
    expect(passes[0]).toStrictEqual({
      ...sharedExpected,
      arrow: [
        {
          ...marker("arrows"),
          colors: [],
          color: SOURCE_1_COLOR_RGBA,
          depth: {
            enable: true,
            mask: true,
          },
          blend: {
            enable: true,
            func: {
              src: "constant color",
              dst: "src alpha",
            },
            color: SOURCE_1_COLOR,
          },
        },
      ],
      lineList: [
        {
          ...marker("foo"),
          colors: [],
          color: SOURCE_1_COLOR_RGBA,
          depth: {
            enable: true,
            mask: true,
          },
          blend: {
            enable: true,
            func: {
              src: "constant color",
              dst: "src alpha",
            },
            color: SOURCE_1_COLOR,
          },
        },
      ],
    });
    expect(passes[1]).toStrictEqual({
      ...sharedExpected,
      lineList: [
        {
          ...marker(`${SECOND_SOURCE_PREFIX}/foo`),
          colors: [],
          color: BASE_COLOR_RGBA,
          depth: {
            enable: false,
          },
          blend: {
            enable: true,
            func: {
              src: "constant color",
              dst: "zero",
            },
            color: BASE_COLOR,
          },
        },
      ],
      pointcloud: [
        {
          ...marker(`${SECOND_SOURCE_PREFIX}/foo`),
          colors: [],
          color: BASE_COLOR_RGBA,
          depth: {
            enable: false,
          },
          blend: {
            enable: true,
            func: {
              src: "constant color",
              dst: "zero",
            },
            color: BASE_COLOR,
          },
        },
      ],
    });
    expect(passes[2]).toStrictEqual({
      ...sharedExpected,
      lineList: [
        {
          ...marker(`${SECOND_SOURCE_PREFIX}/foo`),
          colors: [],
          color: SOURCE_2_COLOR_RGBA,
          depth: {
            enable: true,
          },
          blend: {
            enable: true,
            func: {
              src: "constant color",
              dst: "one",
            },
            color: SOURCE_2_COLOR,
          },
        },
      ],
      pointcloud: [
        {
          ...marker(`${SECOND_SOURCE_PREFIX}/foo`),
          colors: [],
          color: SOURCE_2_COLOR_RGBA,
          depth: {
            enable: true,
          },
          blend: {
            enable: true,
            func: {
              src: "constant color",
              dst: "one",
            },
            color: SOURCE_2_COLOR,
          },
        },
      ],
    });
  });
});
