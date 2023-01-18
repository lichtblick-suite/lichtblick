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
        userNodes: {},
        playbackConfig: { speed: 1 },
      }),
    ).toMatchInlineSnapshot(`
      {
        "configById": {
          "3D!1": {
            "cameraState": {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 59.99999999999999,
              "target": [
                0,
                0,
                0,
              ],
              "targetOffset": [
                0,
                0,
                0,
              ],
              "targetOrientation": [
                0,
                0,
                0,
                1,
              ],
              "thetaOffset": 0,
            },
            "followMode": "follow-none",
            "followTf": undefined,
            "layers": {},
            "publish": {
              "pointTopic": "/clicked_point",
              "poseEstimateThetaDeviation": 0.26179939,
              "poseEstimateTopic": "/initialpose",
              "poseEstimateXDeviation": 0.5,
              "poseEstimateYDeviation": 0.5,
              "poseTopic": "/move_base_simple/goal",
              "type": "point",
            },
            "scene": {},
            "topics": {},
            "transforms": {},
          },
        },
        "globalVariables": {},
        "layout": "3D!1",
        "playbackConfig": {
          "speed": 1,
        },
        "userNodes": {},
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
        userNodes: {},
        playbackConfig: { speed: 1 },
      }),
    ).toMatchInlineSnapshot(`
      {
        "configById": {
          "3D!1": {
            "cameraState": {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 59.99999999999999,
              "target": [
                0,
                0,
                0,
              ],
              "targetOffset": [
                0,
                0,
                0,
              ],
              "targetOrientation": [
                0,
                0,
                0,
                1,
              ],
              "thetaOffset": 0,
            },
            "followMode": "follow-none",
            "followTf": undefined,
            "layers": {},
            "publish": {
              "pointTopic": "/clicked_point",
              "poseEstimateThetaDeviation": 0.26179939,
              "poseEstimateTopic": "/initialpose",
              "poseEstimateXDeviation": 0.5,
              "poseEstimateYDeviation": 0.5,
              "poseTopic": "/move_base_simple/goal",
              "type": "point",
            },
            "scene": {},
            "topics": {},
            "transforms": {},
          },
          "XXX!a": {
            "foo": "bar",
          },
          "XXX!b": {
            "foo": "baz",
          },
        },
        "globalVariables": {},
        "layout": {
          "direction": "row",
          "first": {
            "direction": "row",
            "first": "XXX!a",
            "second": "3D!1",
          },
          "second": "XXX!b",
        },
        "playbackConfig": {
          "speed": 1,
        },
        "userNodes": {},
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
        userNodes: {},
        playbackConfig: { speed: 1 },
      }),
    ).toMatchInlineSnapshot(`
      {
        "configById": {
          "3D!1": {
            "cameraState": {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 59.99999999999999,
              "target": [
                0,
                0,
                0,
              ],
              "targetOffset": [
                0,
                0,
                0,
              ],
              "targetOrientation": [
                0,
                0,
                0,
                1,
              ],
              "thetaOffset": 0,
            },
            "followMode": "follow-none",
            "followTf": undefined,
            "layers": {},
            "publish": {
              "pointTopic": "/clicked_point",
              "poseEstimateThetaDeviation": 0.26179939,
              "poseEstimateTopic": "/initialpose",
              "poseEstimateXDeviation": 0.5,
              "poseEstimateYDeviation": 0.5,
              "poseTopic": "/move_base_simple/goal",
              "type": "point",
            },
            "scene": {},
            "topics": {},
            "transforms": {},
          },
          "Tab!a": {
            "activeTabIdx": 0,
            "tabs": [
              {
                "layout": "XXX!c",
                "title": "One",
              },
              {
                "layout": "Tab!b",
                "title": "Two",
              },
              {
                "layout": "XXX!d",
                "title": "Three",
              },
            ],
          },
          "Tab!b": {
            "activeTabIdx": 0,
            "tabs": [
              {
                "layout": {
                  "direction": "row",
                  "first": "XXX!a",
                  "second": "3D!1",
                },
                "title": "Four",
              },
            ],
          },
          "XXX!a": {
            "foo": "foo",
          },
          "XXX!b": {
            "foo": "bar",
          },
          "XXX!c": {
            "foo": "baz",
          },
          "XXX!d": {
            "foo": "quux",
          },
        },
        "globalVariables": {},
        "layout": {
          "direction": "row",
          "first": "Tab!a",
          "second": "XXX!b",
        },
        "playbackConfig": {
          "speed": 1,
        },
        "userNodes": {},
      }
    `);
  });
});
