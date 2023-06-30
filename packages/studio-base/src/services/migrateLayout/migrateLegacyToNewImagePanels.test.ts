// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { migrateLegacyToNewImagePanels } from "./migrateLegacyToNewImagePanels";

let MOCK_ID = 0;
jest.mock("@foxglove/studio-base/util/layout", () => ({
  ...jest.requireActual("@foxglove/studio-base/util/layout"),
  getPanelIdForType(type: string) {
    return `${type}!${++MOCK_ID}`;
  },
}));

describe("migrateLegacyToNewImagePanels", () => {
  beforeEach(() => {
    MOCK_ID = 0;
  });
  it("migrates legacy Image panel config at root", () => {
    expect(
      migrateLegacyToNewImagePanels({
        layout: "ImageViewPanel!a",
        configById: {
          "ImageViewPanel!a": {
            cameraTopic: "/cam/image_rect_compressed",
            enabledMarkerTopics: ["/cam/annotations", "/cam/lidar"],
            transformMarkers: false,
            synchronize: true,
            mode: "fit",
            pan: {
              x: 0,
              y: 0,
            },
            rotation: 90,
            zoom: 1,
            flipHorizontal: true,
            flipVertical: true,
            minValue: 2,
            maxValue: 6,
          },
        },
        globalVariables: {},
        userNodes: {},
        playbackConfig: { speed: 1 },
      }),
    ).toMatchInlineSnapshot(`
      {
        "configById": {
          "Image!1": {
            "cameraState": {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 60,
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
              "thetaOffset": 45,
            },
            "followMode": "follow-pose",
            "followTf": undefined,
            "imageMode": {
              "annotations": {
                "/cam/annotations": {
                  "visible": true,
                },
                "/cam/lidar": {
                  "visible": true,
                },
              },
              "calibrationTopic": undefined,
              "flipHorizontal": true,
              "flipVertical": true,
              "imageTopic": "/cam/image_rect_compressed",
              "maxValue": 6,
              "minValue": 2,
              "rotation": 90,
              "synchronize": true,
            },
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
        "layout": "Image!1",
        "playbackConfig": {
          "speed": 1,
        },
        "userNodes": {},
      }
    `);
  });

  it("migrates legacy Image panel config inside layout", () => {
    expect(
      migrateLegacyToNewImagePanels({
        layout: {
          direction: "row",
          first: { direction: "row", first: "XXX!a", second: "ImageViewPanel!a" },
          second: "XXX!b",
        },
        configById: { "ImageViewPanel!a": {}, "XXX!a": { foo: "bar" }, "XXX!b": { foo: "baz" } },
        globalVariables: {},
        userNodes: {},
        playbackConfig: { speed: 1 },
      }),
    ).toMatchInlineSnapshot(`
      {
        "configById": {
          "Image!1": {
            "cameraState": {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 60,
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
              "thetaOffset": 45,
            },
            "followMode": "follow-pose",
            "followTf": undefined,
            "imageMode": {
              "annotations": {},
              "calibrationTopic": undefined,
              "flipHorizontal": undefined,
              "flipVertical": undefined,
              "imageTopic": undefined,
              "maxValue": undefined,
              "minValue": undefined,
              "rotation": 0,
              "synchronize": undefined,
            },
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
            "second": "Image!1",
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

  it("migrates legacy Image panel config inside tab", () => {
    expect(
      migrateLegacyToNewImagePanels({
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
              {
                title: "Four",
                layout: { direction: "row", first: "XXX!a", second: "ImageViewPanel!a" },
              },
            ],

            activeTabIdx: 0,
          },
          "ImageViewPanel!a": {},
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
          "Image!1": {
            "cameraState": {
              "distance": 20,
              "far": 5000,
              "fovy": 45,
              "near": 0.5,
              "perspective": true,
              "phi": 60,
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
              "thetaOffset": 45,
            },
            "followMode": "follow-pose",
            "followTf": undefined,
            "imageMode": {
              "annotations": {},
              "calibrationTopic": undefined,
              "flipHorizontal": undefined,
              "flipVertical": undefined,
              "imageTopic": undefined,
              "maxValue": undefined,
              "minValue": undefined,
              "rotation": 0,
              "synchronize": undefined,
            },
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
                  "second": "Image!1",
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
