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

import ArrowDecisionIcon from "@mdi/svg/svg/arrow-decision.svg";
import BlurIcon from "@mdi/svg/svg/blur.svg";
import CubeOutline from "@mdi/svg/svg/cube-outline.svg";
import GridIcon from "@mdi/svg/svg/grid.svg";
import HexagonMultipleIcon from "@mdi/svg/svg/hexagon-multiple.svg";
import HexagonIcon from "@mdi/svg/svg/hexagon.svg";
import PentagonOutlineIcon from "@mdi/svg/svg/pentagon-outline.svg";
import RadarIcon from "@mdi/svg/svg/radar.svg";
import RobotIcon from "@mdi/svg/svg/robot.svg";

import LaserScanVert from "@foxglove-studio/app/panels/ThreeDimensionalViz/LaserScanVert";
import sceneBuilderHooks from "@foxglove-studio/app/panels/ThreeDimensionalViz/SceneBuilder/defaultHooks";
import { defaultMapPalette } from "@foxglove-studio/app/panels/ThreeDimensionalViz/commands/utils";
import {
  GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE,
  NAV_MSGS_OCCUPANCY_GRID_DATATYPE,
  NAV_MSGS_PATH_DATATYPE,
  POINT_CLOUD_DATATYPE,
  POSE_STAMPED_DATATYPE,
  SENSOR_MSGS_LASER_SCAN_DATATYPE,
  TF_DATATYPE,
  VISUALIZATION_MSGS_MARKER_DATATYPE,
  VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
  WEBVIZ_MARKER_DATATYPE,
  WEBVIZ_MARKER_ARRAY_DATATYPE,
  DIAGNOSTIC_TOPIC,
} from "@foxglove-studio/app/util/globalConstants";

export function perPanelHooks() {
  const SUPPORTED_MARKER_DATATYPES = {
    // generally supported datatypes
    VISUALIZATION_MSGS_MARKER_DATATYPE,
    VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
    WEBVIZ_MARKER_DATATYPE,
    WEBVIZ_MARKER_ARRAY_DATATYPE,
    POSE_STAMPED_DATATYPE,
    POINT_CLOUD_DATATYPE,
    SENSOR_MSGS_LASER_SCAN_DATATYPE,
    NAV_MSGS_OCCUPANCY_GRID_DATATYPE,
    NAV_MSGS_PATH_DATATYPE,
    GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE,
    TF_DATATYPE,
  };

  return {
    DiagnosticSummary: {
      defaultConfig: {
        pinnedIds: [],
        hardwareIdFilter: "",
        topicToRender: DIAGNOSTIC_TOPIC,
      },
    },
    ImageView: {
      defaultConfig: {
        cameraTopic: "",
        enabledMarkerTopics: [],
        customMarkerTopicOptions: [],
        scale: 0.2,
        transformMarkers: false,
        synchronize: false,
        mode: "fit",
        zoomPercentage: 100,
        offset: [0, 0],
      },
      imageMarkerDatatypes: ["visualization_msgs/ImageMarker", "webviz_msgs/ImageMarkerArray"],
      canTransformMarkersByTopic: (topic: string) => !topic.includes("rect"),
    },
    GlobalVariableSlider: {
      getVariableSpecificOutput: () => undefined,
    },
    StateTransitions: { defaultConfig: { paths: [] }, customStateTransitionColors: {} },
    ThreeDimensionalViz: {
      defaultConfig: {
        checkedKeys: ["name:Topics"],
        expandedKeys: ["name:Topics"],
        followTf: undefined,
        cameraState: {},
        modifiedNamespaceTopics: [],
        pinTopics: false,
        settingsByKey: {},
        autoSyncCameraState: false,
        autoTextBackgroundColor: true,
      },
      MapComponent: undefined,
      topicSettingsEditors: {},
      copy: {},
      SUPPORTED_MARKER_DATATYPES,
      BLACKLIST_TOPICS: [] as string[],
      iconsByClassification: { DEFAULT: CubeOutline },
      allSupportedMarkers: [
        "arrow",
        "cube",
        "cubeList",
        "cylinder",
        "filledPolygon",
        "grid",
        "instancedLineList",
        "laserScan",
        "linedConvexHull",
        "lineList",
        "lineStrip",
        "overlayIcon",
        "pointcloud",
        "points",
        "poseMarker",
        "sphere",
        "sphereList",
        "text",
        "triangleList",
      ],
      topics: [],
      iconsByDatatype: {
        [VISUALIZATION_MSGS_MARKER_DATATYPE]: HexagonIcon,
        [VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE]: HexagonMultipleIcon,
        [NAV_MSGS_OCCUPANCY_GRID_DATATYPE]: GridIcon,
        [NAV_MSGS_PATH_DATATYPE]: ArrowDecisionIcon,
        [SENSOR_MSGS_LASER_SCAN_DATATYPE]: RadarIcon,
        [GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE]: PentagonOutlineIcon,
        [POINT_CLOUD_DATATYPE]: BlurIcon,
        [POSE_STAMPED_DATATYPE]: RobotIcon,
        [WEBVIZ_MARKER_DATATYPE]: HexagonIcon,
        [WEBVIZ_MARKER_ARRAY_DATATYPE]: HexagonMultipleIcon,
      },
      // TODO(Audrey): remove icons config after topic group release
      icons: {},
      LaserScanVert,
      sceneBuilderHooks,
      getMapPalette() {
        return defaultMapPalette;
      },
      ungroupedNodesCategory: "Topics",
      rootTransformFrame: "map",
      defaultFollowTransformFrame: undefined,
      useWorldspacePointSize: () => true,
      createPointCloudPositionBuffer: () => undefined,
    },
    RawMessages: {
      docLinkFunction: (filename: string) => `https://www.google.com/search?q=${filename}`,
    },
  };
}
