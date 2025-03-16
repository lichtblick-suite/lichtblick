// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
// import { defaultPlaybackConfig } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/reducers";

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
    configById: {
      "VehicleControl!15vbcz4": {
        car_id: "map1.json",
        update_map: false,
        pass_mode: false,
        nodeTopicName: "/nav_select",
        nodeDatatype: "msg_interfaces/msg/NavSelectInterface",
        runTopicName: "/emergency_stop",
        runDatatype: "msg_interfaces/msg/EmergencyInterface",
        rfidSource: "/rfid_data",
        pathSource: "/gpp_path",
        batterySource: "/battery_state",
      },
      "Image!2yd3i6i": {
        cameraState: {
          distance: 20,
          perspective: true,
          phi: 60,
          target: [0, 0, 0],
          targetOffset: [0, 0, 0],
          targetOrientation: [0, 0, 0, 1],
          thetaOffset: 45,
          fovy: 45,
          near: 0.5,
          far: 5000,
        },
        followMode: "follow-pose",
        scene: {},
        transforms: {},
        topics: {},
        layers: {},
        publish: {
          type: "point",
          poseTopic: "/move_base_simple/goal",
          pointTopic: "/clicked_point",
          poseEstimateTopic: "/initialpose",
          poseEstimateXDeviation: 0.5,
          poseEstimateYDeviation: 0.5,
          poseEstimateThetaDeviation: 0.26179939,
        },
        imageMode: {},
      },
      "Joystick!3r9hj7": {
        vel: 0.2,
        topic: "/manu_cmd",
        angle: 0.8,
        mode: false,
      },
      "3D!1emiifn": {
        cameraState: {
          distance: 20,
          perspective: true,
          phi: 60,
          target: [0, 0, 0],
          targetOffset: [0, 0, 0],
          targetOrientation: [0, 0, 0, 1],
          thetaOffset: 45,
          fovy: 45,
          near: 0.5,
          far: 5000,
        },
        followMode: "follow-pose",
        scene: {},
        transforms: {},
        topics: {},
        layers: {},
        publish: {
          type: "point",
          poseTopic: "/move_base_simple/goal",
          pointTopic: "/clicked_point",
          poseEstimateTopic: "/initialpose",
          poseEstimateXDeviation: 0.5,
          poseEstimateYDeviation: 0.5,
          poseEstimateThetaDeviation: 0.26179939,
        },
        imageMode: {},
      },
      "hardwareInfo!1e3m38m": {
        hardwareInfoSource: "/hardware_info",
      },
      "LaunchMotion!39ntfap": {
        activeNodeSource: "/active_node",
        activeLaunchSource: "/active_launch",
        killLaunchTopic: "/kill_launch",
        startLaunchTopic: "/start_launch",
      },
      "Tab!3m4s96y": {
        activeTabIdx: 1,
        tabs: [
          {
            title: "1",
            layout: {
              first: "VehicleControl!15vbcz4",
              second: {
                first: "Image!2yd3i6i",
                second: "Joystick!3r9hj7",
                direction: "column",
                splitPercentage: 42.64919941775837,
              },
              direction: "row",
              splitPercentage: 72.35693501454898,
            },
          },
          {
            title: "2",
            layout: "3D!1emiifn",
          },
          {
            title: "3",
            layout: {
              first: "hardwareInfo!1e3m38m",
              second: "LaunchMotion!39ntfap",
              direction: "row",
            },
          },
        ],
      },
    },
    globalVariables: {},
    userNodes: {},
    playbackConfig: {
      speed: 1,
    },
    layout: "Tab!3m4s96y",
  } as const);
