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

import { CameraState, MouseEventObject } from "@foxglove/regl-worldview";

import {
  getNewCameraStateOnFollowChange,
  getUpdatedGlobalVariablesBySelectedObject,
} from "./threeDimensionalVizUtils";

describe("threeDimensionalVizUtils", () => {
  describe("getNewCameraStateOnFollowChange", () => {
    it("changing the follow tf resets the targetOffset", () => {
      const prevFollowTf = "root";
      const prevFollowMode = "follow";
      const prevCameraState: CameraState = {
        perspective: false,
        target: [1322.127197265625, -1484.3931884765625, -20.19326400756836],
        distance: 75,
        phi: 0.7853981633974483,
        targetOffset: [1, 1, 1],
        targetOrientation: [0, 0, 0, 1],
        thetaOffset: 0,
        fovy: 1,
        near: 0,
        far: 1,
      };

      const newCameraState = getNewCameraStateOnFollowChange({
        prevCameraState,
        prevFollowTf,
        prevFollowMode,
        newFollowTf: "another-tf",
        newFollowMode: prevFollowMode,
      });
      expect(newCameraState).toEqual({
        ...prevCameraState,
        targetOffset: [0, 0, 0],
      });
    });

    it("leaving no-follow resets the target offset", () => {
      const prevFollowTf = "root";
      const prevFollowMode = "no-follow";
      const prevCameraState: CameraState = {
        perspective: false,
        target: [1322.127197265625, -1484.3931884765625, -20.19326400756836],
        distance: 75,
        phi: 0.7853981633974483,
        targetOffset: [1, 1, 1],
        targetOrientation: [0, 0, 0, 1],
        thetaOffset: 0,
        fovy: 1,
        near: 0,
        far: 1,
      };

      const newCameraState = getNewCameraStateOnFollowChange({
        prevCameraState,
        prevFollowTf,
        prevFollowMode,
        newFollowTf: prevFollowTf,
        newFollowMode: "follow",
      });
      expect(newCameraState).toEqual({
        ...prevCameraState,
        targetOffset: [0, 0, 0],
      });
    });

    it("entering no-follow leaves the target offset unchanged", () => {
      const prevFollowTf = "root";
      const prevFollowMode = "follow";
      const prevCameraState: CameraState = {
        perspective: false,
        target: [1322.127197265625, -1484.3931884765625, -20.19326400756836],
        distance: 75,
        phi: 0.7853981633974483,
        targetOffset: [1, 1, 1],
        targetOrientation: [0, 0, 0, 1],
        thetaOffset: 0,
        fovy: 1,
        near: 0,
        far: 1,
      };

      const newCameraState = getNewCameraStateOnFollowChange({
        prevCameraState,
        prevFollowTf,
        prevFollowMode,
        newFollowTf: prevFollowTf,
        newFollowMode: "no-follow",
      });
      expect(newCameraState).toEqual(prevCameraState);
    });
  });

  describe("getUpdatedGlobalVariablesBySelectedObject", () => {
    const linkedGlobalVariables = [
      {
        topic: "/foo/bar",
        markerKeyPath: ["name"],
        name: "linkedName",
      },
      {
        topic: "/bar/qux",
        markerKeyPath: ["age"],
        name: "linkedVarTwo",
      },
    ];

    it("returns object values", () => {
      const mouseEventObject = {
        object: {
          name: 123456,
          interactionData: {
            topic: "/foo/bar",
          },
        },
      };
      expect(
        getUpdatedGlobalVariablesBySelectedObject(
          mouseEventObject as unknown as MouseEventObject,
          linkedGlobalVariables,
        ),
      ).toEqual({
        linkedName: 123456,
      });
    });

    it("returns values from instanced objects", () => {
      const mouseEventObject = {
        object: {
          interactionData: {
            topic: "/foo/bar",
          },
          metadataByIndex: [
            {
              name: 654321,
            },
          ],
        },
        instanceIndex: 0,
      };

      expect(
        getUpdatedGlobalVariablesBySelectedObject(
          mouseEventObject as unknown as MouseEventObject,
          linkedGlobalVariables,
        ),
      ).toEqual({
        linkedName: 654321,
      });
    });
  });
});
