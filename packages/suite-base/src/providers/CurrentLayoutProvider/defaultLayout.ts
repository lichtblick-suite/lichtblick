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
        "layers": {},
        "cameraState": {
          "perspective": true,
          "distance": 25.847108697961588,
          "phi": 0.00005729832627056611,
          "thetaOffset": 92.08383115335366,
          "targetOffset": [
            -2.096291007842728,
            -5.369505194018394,
            5.505067093446401e-18
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
        "followTf": "base_link",
        "scene": {
          "backgroundColor": "#000000",
          "transforms": {
            "axisScale": 4.5,
            "labelSize": 0.15
          }
        },
        "transforms": {
          "frame:base_link_inertia": {
            "visible": false
          },
          "frame:base": {
            "visible": false
          },
          "frame:arm_base_link": {
            "visible": false
          },
          "frame:arm_mount": {
            "visible": false
          },
          "frame:liftkit_top": {
            "visible": false
          },
          "frame:liftkit_mid": {
            "visible": false
          },
          "frame:lidarrr_mount": {
            "visible": false
          },
          "frame:lidarrl_mount": {
            "visible": false
          },
          "frame:lidarfr_mount": {
            "visible": false
          },
          "frame:lidarfl_mount": {
            "visible": false
          },
          "frame:lidar_nav": {
            "visible": false
          },
          "frame:wheel_3": {
            "visible": false
          },
          "frame:steering_3": {
            "visible": false
          },
          "frame:wheel_2": {
            "visible": false
          },
          "frame:steering_2": {
            "visible": false
          },
          "frame:wheel": {
            "visible": false
          },
          "frame:steering": {
            "visible": false
          },
          "frame:livox_amr_imu": {
            "visible": false
          },
          "frame:shutter_lidarmani": {
            "visible": false
          },
          "frame:shutter_fisheye": {
            "visible": false
          },
          "frame:lidar_mani": {
            "visible": false
          },
          "frame:fisheye_mount": {
            "visible": false
          },
          "frame:ft_frame": {
            "visible": false
          },
          "frame:eoa_vision_module_detailed_assembly": {
            "visible": false
          },
          "frame:tool0": {
            "visible": false
          },
          "frame:flange": {
            "visible": false
          },
          "frame:checkerboard": {
            "visible": false
          },
          "frame:wrist_3_link": {
            "visible": false
          },
          "frame:wrist_2_link": {
            "visible": false
          },
          "frame:wrist_1_link": {
            "visible": false
          },
          "frame:forearm_link": {
            "visible": false
          },
          "frame:upper_arm_link": {
            "visible": false
          },
          "frame:shoulder_link": {
            "visible": false
          },
          "frame:arm_base_zero": {
            "visible": false
          },
          "frame:livox_manipulation_pcd": {
            "visible": false
          },
          "frame:fisheye": {
            "visible": false
          }
        },
        "topics": {
          "/amcl_pose": {
            "visible": true
          },
          "/collision_zones": {
            "visible": true
          },
          "/global_costmap/costmap": {
            "visible": true
          },
          "/initialpose": {
            "visible": true,
            "axisScale": 1.7,
            "type": "arrow"
          },
          "/map": {
            "visible": true
          },
          "/pointcloud_clipped": {
            "visible": false,
            "colorField": "z",
            "colorMode": "colormap",
            "colorMap": "turbo",
            "explicitAlpha": 0.6,
            "decayTime": 2.5
          },
          "/rgb_pointcloud": {
            "visible": false
          },
          "/robot_description": {
            "visible": false
          },
          "/genz/local_map": {
            "visible": false,
            "colorField": "z",
            "colorMode": "colormap",
            "colorMap": "turbo"
          },
          "/local_costmap/published_footprint": {
            "visible": true
          },
          "/global_costmap/published_footprint": {
            "visible": true
          },
          "/projected_map": {
            "visible": true
          },
          "/scan": {
            "visible": true,
            "colorField": "intensity",
            "colorMode": "flat",
            "colorMap": "turbo",
            "pointSize": 8,
            "flatColor": "#ff0000ff"
          }
        },
        "publish": {
          "type": "pose",
          "poseTopic": "/move_base_simple/goal",
          "pointTopic": "/clicked_point",
          "poseEstimateTopic": "/initialpose",
          "poseEstimateXDeviation": 0.5,
          "poseEstimateYDeviation": 0.5,
          "poseEstimateThetaDeviation": 0.26179939
        },
        "imageMode": {}
      }
    },
    "globalVariables": {},
    "userNodes": {},
    "playbackConfig": {
      "speed": 1
    },
    "layout": "3D!18i6zy7"
  } as const);
