// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/reducers";

/**
 * Overridden default layout that may have been provided when self-hosting via Docker
 * */
const staticDefaultLayout = (globalThis as { LICHTBLICK_SUITE_DEFAULT_LAYOUT?: LayoutData })
  .LICHTBLICK_SUITE_DEFAULT_LAYOUT;

/**
 * This is loaded when the user has no layout selected on application launch
 * to avoid presenting the user with a blank layout.
 */
export const defaultLayout: LayoutData =
  staticDefaultLayout ??
  ({
    "configById": {
      "3D!18i6zy7": {
        "layers": {
          "845139cb-26bc-40b3-8161-8ab60af4baf5": {
            "visible": false,
            "frameLocked": true,
            "label": "Grid",
            "instanceId": "845139cb-26bc-40b3-8161-8ab60af4baf5",
            "layerId": "foxglove.Grid",
            "size": 10,
            "divisions": 10,
            "lineWidth": 1,
            "color": "#248eff",
            "position": [
              0,
              0,
              0
            ],
            "rotation": [
              0,
              0,
              0
            ],
            "order": 1
          }
        },
        "cameraState": {
          "perspective": true,
          "distance": 18.0499999999884,
          "phi": 0.33966750397735296,
          "thetaOffset": 93.11089564339326,
          "targetOffset": [
            -1.1007944490754582,
            -0.8121366509443774,
            4.5030645444296294e-17
          ],
          "target": [
            0,
            0,
            0
          ],
          "targetOrientation": [
            0,
            0,
            0,
            1
          ],
          "fovy": 45,
          "near": 0.5,
          "far": 5000
        },
        "followMode": "follow-pose",
        "scene": {
          "backgroundColor": "#202020"
        },
        "transforms": {},
        "topics": {
          "/robot_description": {
            "visible": true
          },
          "/scan": {
            "visible": true,
            "colorField": "intensity",
            "colorMode": "flat",
            "colorMap": "turbo",
            "pointSize": 5,
            "flatColor": "#ff0000ff",
            "decayTime": 0.5
          },
          "/projected_map": {
            "visible": true
          },
          "/map": {
            "visible": true
          },
          "/local_costmap/costmap": {
            "visible": true
          },
          "/collision_zones": {
            "visible": true
          },
          "/amcl_pose": {
            "visible": true
          }
        },
        "publish": {
          "type": "point",
          "poseTopic": "/move_base_simple/goal",
          "pointTopic": "/clicked_point",
          "poseEstimateTopic": "/initialpose",
          "poseEstimateXDeviation": 0.5,
          "poseEstimateYDeviation": 0.5,
          "poseEstimateThetaDeviation": 0.26179939
        },
        "imageMode": {},
        "followTf": "base_link"
      }
    },
    "globalVariables": {},
    "userNodes": {},
    "playbackConfig": {
      "speed": 1
    },
    "layout": "3D!18i6zy7"
  }as const);
