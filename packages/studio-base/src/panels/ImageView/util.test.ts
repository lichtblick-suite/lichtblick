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

import { Topic } from "@foxglove/studio-base/players/types";

import {
  getCameraInfoTopic,
  getMarkerOptions,
  getRelatedMarkerTopics,
  groupTopics,
  buildMarkerData,
  getCameraNamespace,
} from "./util";

describe("ImageView", () => {
  describe("getCameraInfoTopic", () => {
    it("keeps prefix", () => {
      expect(getCameraInfoTopic("/some_camera_topic/image_rect_color")).toBe(
        "/some_camera_topic/camera_info",
      );
      expect(getCameraInfoTopic("/other_camera_topic/image_rect_color")).toBe(
        "/other_camera_topic/camera_info",
      );
    });
    it("isn't restricted to rectified images", () => {
      expect(getCameraInfoTopic("/some_camera_topic/something_else")).toBe(
        "/some_camera_topic/camera_info",
      );
      expect(getCameraInfoTopic("/other_camera_topic/something_else")).toBe(
        "/other_camera_topic/camera_info",
      );
    });
  });

  describe("getMarkerOptions", () => {
    const allMarkerTopics: Topic[] = [
      { name: "/some_camera_topic/marker1", datatype: "visualization_msgs/ImageMarker" },
      { name: "/some_camera_topic/marker2", datatype: "vision_msgs/ImageMarker" },
      { name: "/old/some_camera_topic/marker3", datatype: "vision_msgs/ImageMarker" },
      { name: "/camera_rear_medium/marker4", datatype: "vision_msgs/ImageMarker" }, // not included because it's for a different camera
      { name: "/unknown_camera/marker5", datatype: "vision_msgs/ImageMarker" },
    ];
    const allCameraNamespaces = ["/some_camera_topic", "/camera_rear_medium"];
    it("filters and sorts topics relevant to this camera", () => {
      expect(
        getMarkerOptions(
          "/some_camera_topic/image_rect_color",
          allMarkerTopics,
          allCameraNamespaces,
          ["visualization_msgs/ImageMarker", "vision_msgs/ImageMarker"],
        ),
      ).toEqual([
        "/old/some_camera_topic/marker3",
        "/some_camera_topic/marker1",
        "/some_camera_topic/marker2",
      ]);
    });
  });

  describe("getRelatedMarkerTopics", () => {
    it("returns topics that match the last section of a topic path", () => {
      expect(
        getRelatedMarkerTopics(
          ["first_camera_topic/marker1"],
          ["second_camera_topic/marker2", "second_camera_topic/marker1"],
        ),
      ).toEqual(["second_camera_topic/marker1"]);
      expect(
        getRelatedMarkerTopics(
          ["first_camera_topic/marker3"],
          ["second_camera_topic/marker2", "second_camera_topic/marker1"],
        ),
      ).toEqual([]);
      expect(
        getRelatedMarkerTopics(
          ["first_camera_topic/marker1", "first_camera_topic/marker3"],
          ["second_camera_topic/marker2", "second_camera_topic/marker1"],
        ),
      ).toEqual(["second_camera_topic/marker1"]);
    });
  });

  describe("getCameraNamespace", () => {
    it("works with a normal camera topic", () => {
      expect(getCameraNamespace("/camera_back_left/compressed")).toEqual("/camera_back_left");
    });
    it("strips 'old' camera topics", () => {
      expect(getCameraNamespace("/old/camera_back_left/compressed")).toEqual("/camera_back_left");
      expect(getCameraNamespace("/camera_back_left/old/compressed")).toEqual("/camera_back_left");
    });
    it("includes studio_source_2 in camera topics", () => {
      expect(getCameraNamespace("/studio_source_2/camera_back_left/compressed")).toEqual(
        "/studio_source_2/camera_back_left",
      );
    });
    it("Returns undefined when encountering a single level topic", () => {
      expect(getCameraNamespace("/camera_back_left")).toEqual(undefined);
    });
  });

  describe("groupTopics", () => {
    const topic = (name: string) => ({ name, datatype: "dummy" });

    it("groups by camera name", () => {
      expect(
        groupTopics([
          topic("/camera_1/foo"),
          topic("/camera_2/foo"),
          topic("/camera_1/bar"),
          topic("/weird_topic"),
        ]),
      ).toEqual(
        new Map([
          ["/camera_1", [topic("/camera_1/foo"), topic("/camera_1/bar")]],
          ["/camera_2", [topic("/camera_2/foo")]],
          ["/weird_topic", [topic("/weird_topic")]],
        ]),
      );
    });

    it("puts /old topics under the correct camera", () => {
      expect(
        groupTopics([
          topic("/camera_1/foo"),
          topic("/old/camera_2/foo"),
          topic("/old/camera_1/bar"),
          topic("/camera_2/old/foo"),
        ]),
      ).toEqual(
        new Map([
          ["/camera_1", [topic("/camera_1/foo"), topic("/old/camera_1/bar")]],
          ["/camera_2", [topic("/old/camera_2/foo"), topic("/camera_2/old/foo")]],
        ]),
      );
    });

    it("Separates /studio_source_2 topics", () => {
      expect(
        groupTopics([
          topic("/camera_1/foo"),
          topic("/camera_1/bar"),
          topic("/studio_source_2/camera_1/foo"),
          topic("/studio_source_2/camera_1/bar"),
          topic("/studio_source_2/camera_2/foo"),
        ]),
      ).toEqual(
        new Map([
          ["/camera_1", [topic("/camera_1/foo"), topic("/camera_1/bar")]],
          [
            "/studio_source_2/camera_1",
            [topic("/studio_source_2/camera_1/foo"), topic("/studio_source_2/camera_1/bar")],
          ],
          ["/studio_source_2/camera_2", [topic("/studio_source_2/camera_2/foo")]],
        ]),
      );
    });
  });

  describe("buildMarkerData", () => {
    const cameraInfo = {
      width: 10,
      height: 5,
      binning_x: 0,
      binning_y: 0,
      roi: {
        x_offset: 0,
        y_offset: 0,
        height: 0,
        width: 0,
        do_rectify: false,
      },
      distortion_model: "" as any,
      D: [],
      K: [],
      P: [],
      R: [],
    };

    const marker = {
      topic: "foo",
      receiveTime: { sec: 0, nsec: 0 },
      message: {},
    };

    it("returns nothing if markers are empty", () => {
      expect(
        buildMarkerData({
          markers: [],
          transformMarkers: true,
          cameraInfo: cameraInfo as any,
        }),
      ).toEqual({
        markers: [],
        originalHeight: undefined,
        originalWidth: undefined,
        cameraModel: undefined,
      });
    });

    it("requires cameraInfo if transformMarkers is true", () => {
      expect(
        buildMarkerData({
          markers: [marker],
          transformMarkers: false,
          cameraInfo: undefined,
        }),
      ).toEqual({
        markers: [marker],
        cameraModel: undefined,
        originalWidth: undefined,
        originalHeight: undefined,
      });

      expect(
        buildMarkerData({
          markers: [marker],
          transformMarkers: true,
          cameraInfo: undefined,
        }),
      ).toEqual(undefined);
    });
  });
});
