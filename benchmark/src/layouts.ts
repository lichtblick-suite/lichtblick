// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Layout, LayoutID, ISO8601Timestamp } from "@foxglove/studio-base";

const LAYOUTS = new Map<string, Layout>([
  [
    "benchmark-raw-messages",
    {
      id: "benchmark-raw-messages" as LayoutID,
      name: "Benchmark - RawMessages",
      permission: "CREATOR_WRITE",
      baseline: {
        data: {
          configById: {
            "RawMessages!a": {
              topicPath: "/imu",
            },
          },
          globalVariables: {},
          userNodes: {},
          linkedGlobalVariables: [],
          playbackConfig: { speed: 1.0 },
          layout: "RawMessages!a",
        },
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      },
      working: undefined,
      syncInfo: undefined,
    },
  ],
  [
    "benchmark-3d-panel",
    {
      id: "benchmark-3d-panel" as LayoutID,
      name: "Benchmark - ThreeDeeRender",
      permission: "CREATOR_WRITE",
      baseline: {
        data: {
          configById: {
            "3D!a": {
              transforms: {
                base_link: {
                  visible: true,
                },
                map: {
                  visible: true,
                },
                RADAR_FRONT: {
                  visible: true,
                },
                RADAR_FRONT_LEFT: {
                  visible: true,
                },
                RADAR_FRONT_RIGHT: {
                  visible: true,
                },
                RADAR_BACK_LEFT: {
                  visible: true,
                },
                RADAR_BACK_RIGHT: {
                  visible: true,
                },
                LIDAR_TOP: {
                  visible: true,
                },
                CAM_FRONT: {
                  visible: true,
                },
                CAM_FRONT_RIGHT: {
                  visible: true,
                },
                CAM_BACK_RIGHT: {
                  visible: true,
                },
                CAM_BACK: {
                  visible: true,
                },
                CAM_BACK_LEFT: {
                  visible: true,
                },
                CAM_FRONT_LEFT: {
                  visible: true,
                },
              },
              topics: {
                "/semantic_map": {
                  visible: true,
                },
                "/markers/annotations": {
                  visible: true,
                },
                "/map": {
                  visible: true,
                },
                "/drivable_area": {
                  visible: true,
                },
                "/RADAR_FRONT": {
                  visible: true,
                },
                "/RADAR_FRONT_LEFT": {
                  visible: true,
                },
                "/RADAR_FRONT_RIGHT": {
                  visible: true,
                },
                "/RADAR_BACK_LEFT": {
                  visible: true,
                },
                "/RADAR_BACK_RIGHT": {
                  visible: true,
                },
                "/LIDAR_TOP": {
                  visible: true,
                },
                "/pose": {
                  visible: true,
                },
              },
              layers: {
                "4a051a91-cd3d-4b38-aebb-cd69aba50fe8": {
                  visible: true,
                  label: "Grid",
                  instanceId: "4a051a91-cd3d-4b38-aebb-cd69aba50fe8",
                  layerId: "foxglove.Grid",
                  order: 1,
                },
              },
            },
          },
          globalVariables: {},
          userNodes: {},
          linkedGlobalVariables: [],
          playbackConfig: { speed: 1.0 },
          layout: "3D!a",
        },
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      },
      working: undefined,
      syncInfo: undefined,
    },
  ],
  [
    "benchmark-legacy-3d-panel",
    {
      id: "benchmark-legacy-3d-panel" as LayoutID,
      name: "Benchmark - ThreeDimensionalViz",
      permission: "CREATOR_WRITE",
      baseline: {
        data: {
          configById: {
            "3D Panel!a": {
              autoSyncCameraState: false,
              autoTextBackgroundColor: true,
              cameraState: {},
              checkedKeys: [
                "name:Topics",
                "t:/markers/annotations",
                "t:/pose",
                "t:/LIDAR_TOP",
                "t:/RADAR_BACK_RIGHT",
                "t:/RADAR_BACK_LEFT",
                "t:/RADAR_FRONT_RIGHT",
                "t:/RADAR_FRONT_LEFT",
                "t:/RADAR_FRONT",
                "t:/drivable_area",
                "t:/semantic_map",
                "t:/map",
                "t:/tf",
                "t:/foxglove/grid",
              ],
              clickToPublishPoseTopic: "/move_base_simple/goal",
              clickToPublishPointTopic: "/clicked_point",
              clickToPublishPoseEstimateTopic: "/initialpose",
              clickToPublishPoseEstimateXDeviation: 0.5,
              clickToPublishPoseEstimateYDeviation: 0.5,
              clickToPublishPoseEstimateThetaDeviation: 0.26179939,
              customBackgroundColor: "#000000",
              diffModeEnabled: true,
              expandedKeys: ["name:Topics"],
              followMode: "follow",
              modifiedNamespaceTopics: [],
              pinTopics: false,
              settingsByKey: {},
              useThemeBackgroundColor: true,
            },
          },
          globalVariables: {},
          userNodes: {},
          linkedGlobalVariables: [],
          playbackConfig: { speed: 1.0 },
          layout: "3D Panel!a",
        },
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      },
      working: undefined,
      syncInfo: undefined,
    },
  ],
]);

export { LAYOUTS };
