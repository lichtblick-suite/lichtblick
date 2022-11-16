// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { migrateLegacyToNew3DPanels } from "@foxglove/studio-base/services/migrateLegacyToNew3DPanels";

let MOCK_ID = 0;
jest.mock("@foxglove/studio-base/util/layout", () => ({
  ...jest.requireActual("@foxglove/studio-base/util/layout"),
  getPanelIdForType(type: string) {
    return `${type}!${++MOCK_ID}`;
  },
}));

describe("migrateLegacyToNew3DPanels", () => {
  beforeEach(() => {
    MOCK_ID = 0;
  });
  it("migrates legacy 3D panel config at root", () => {
    expect(
      migrateLegacyToNew3DPanels({
        layout: "3D Panel!a",
        configById: { "3D Panel!a": {} },
        globalVariables: {},
        linkedGlobalVariables: [],
        userNodes: {},
        playbackConfig: { speed: 1 },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "configById": Object {
          "3D!1": Object {
            "cameraState": Object {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 59.99999999999999,
              "target": Array [
                0,
                0,
                0,
              ],
              "targetOffset": Array [
                0,
                0,
                0,
              ],
              "targetOrientation": Array [
                0,
                0,
                0,
                1,
              ],
              "thetaOffset": 0,
            },
            "followMode": "follow-none",
            "followTf": undefined,
            "layers": Object {},
            "publish": Object {
              "pointTopic": "/clicked_point",
              "poseEstimateThetaDeviation": 0.26179939,
              "poseEstimateTopic": "/initialpose",
              "poseEstimateXDeviation": 0.5,
              "poseEstimateYDeviation": 0.5,
              "poseTopic": "/move_base_simple/goal",
              "type": "point",
            },
            "scene": Object {},
            "topics": Object {},
            "transforms": Object {},
          },
        },
        "globalVariables": Object {},
        "layout": "3D!1",
        "linkedGlobalVariables": Array [],
        "playbackConfig": Object {
          "speed": 1,
        },
        "userNodes": Object {},
      }
    `);
  });

  it("migrates legacy 3D panel config inside layout", () => {
    expect(
      migrateLegacyToNew3DPanels({
        layout: {
          direction: "row",
          first: { direction: "row", first: "XXX!a", second: "3D Panel!a" },
          second: "XXX!b",
        },
        configById: { "3D Panel!a": {}, "XXX!a": { foo: "bar" }, "XXX!b": { foo: "baz" } },
        globalVariables: {},
        linkedGlobalVariables: [],
        userNodes: {},
        playbackConfig: { speed: 1 },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "configById": Object {
          "3D!1": Object {
            "cameraState": Object {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 59.99999999999999,
              "target": Array [
                0,
                0,
                0,
              ],
              "targetOffset": Array [
                0,
                0,
                0,
              ],
              "targetOrientation": Array [
                0,
                0,
                0,
                1,
              ],
              "thetaOffset": 0,
            },
            "followMode": "follow-none",
            "followTf": undefined,
            "layers": Object {},
            "publish": Object {
              "pointTopic": "/clicked_point",
              "poseEstimateThetaDeviation": 0.26179939,
              "poseEstimateTopic": "/initialpose",
              "poseEstimateXDeviation": 0.5,
              "poseEstimateYDeviation": 0.5,
              "poseTopic": "/move_base_simple/goal",
              "type": "point",
            },
            "scene": Object {},
            "topics": Object {},
            "transforms": Object {},
          },
          "XXX!a": Object {
            "foo": "bar",
          },
          "XXX!b": Object {
            "foo": "baz",
          },
        },
        "globalVariables": Object {},
        "layout": Object {
          "direction": "row",
          "first": Object {
            "direction": "row",
            "first": "XXX!a",
            "second": "3D!1",
          },
          "second": "XXX!b",
        },
        "linkedGlobalVariables": Array [],
        "playbackConfig": Object {
          "speed": 1,
        },
        "userNodes": Object {},
      }
    `);
  });

  it("migrates legacy 3D panel config inside tab", () => {
    expect(
      migrateLegacyToNew3DPanels({
        layout: {
          direction: "row",
          first: "Tab!a",
          second: "XXX!b",
        },
        configById: {
          "Tab!a": {
            tabs: [
              { title: "One", layout: "XXX!c" },
              { title: "Two", layout: "Tab!b" },
              { title: "Three", layout: "XXX!d" },
            ],

            activeTabIdx: 0,
          },
          "Tab!b": {
            tabs: [
              { title: "Four", layout: { direction: "row", first: "XXX!a", second: "3D Panel!a" } },
            ],

            activeTabIdx: 0,
          },
          "3D Panel!a": {},
          "XXX!a": { foo: "foo" },
          "XXX!b": { foo: "bar" },
          "XXX!c": { foo: "baz" },
          "XXX!d": { foo: "quux" },
        },
        globalVariables: {},
        linkedGlobalVariables: [],
        userNodes: {},
        playbackConfig: { speed: 1 },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "configById": Object {
          "3D!1": Object {
            "cameraState": Object {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 59.99999999999999,
              "target": Array [
                0,
                0,
                0,
              ],
              "targetOffset": Array [
                0,
                0,
                0,
              ],
              "targetOrientation": Array [
                0,
                0,
                0,
                1,
              ],
              "thetaOffset": 0,
            },
            "followMode": "follow-none",
            "followTf": undefined,
            "layers": Object {},
            "publish": Object {
              "pointTopic": "/clicked_point",
              "poseEstimateThetaDeviation": 0.26179939,
              "poseEstimateTopic": "/initialpose",
              "poseEstimateXDeviation": 0.5,
              "poseEstimateYDeviation": 0.5,
              "poseTopic": "/move_base_simple/goal",
              "type": "point",
            },
            "scene": Object {},
            "topics": Object {},
            "transforms": Object {},
          },
          "Tab!a": Object {
            "activeTabIdx": 0,
            "tabs": Array [
              Object {
                "layout": "XXX!c",
                "title": "One",
              },
              Object {
                "layout": "Tab!b",
                "title": "Two",
              },
              Object {
                "layout": "XXX!d",
                "title": "Three",
              },
            ],
          },
          "Tab!b": Object {
            "activeTabIdx": 0,
            "tabs": Array [
              Object {
                "layout": Object {
                  "direction": "row",
                  "first": "XXX!a",
                  "second": "3D!1",
                },
                "title": "Four",
              },
            ],
          },
          "XXX!a": Object {
            "foo": "foo",
          },
          "XXX!b": Object {
            "foo": "bar",
          },
          "XXX!c": Object {
            "foo": "baz",
          },
          "XXX!d": Object {
            "foo": "quux",
          },
        },
        "globalVariables": Object {},
        "layout": Object {
          "direction": "row",
          "first": "Tab!a",
          "second": "XXX!b",
        },
        "linkedGlobalVariables": Array [],
        "playbackConfig": Object {
          "speed": 1,
        },
        "userNodes": Object {},
      }
    `);
  });
});
