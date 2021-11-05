// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";

const data: PanelsState = {
  layout: {
    first: {
      first: {
        first: "ImageViewPanel!4evmpi6",
        second: {
          direction: "column",
          second: "3D Panel!1ltsiud",
          first: "3D Panel!3vhcz8n",
          splitPercentage: 65.0190114068441,
        },
        direction: "column",
        splitPercentage: 23.878437047756872,
      },
      second: {
        first: {
          first: "Plot!2srxf7j",
          second: "StateTransitions!3v5kkkn",
          direction: "column",
          splitPercentage: 35.91836734693877,
        },
        second: {
          first: "DiagnosticSummary!2ttktu0",
          second: "DiagnosticStatusPanel!2yh7rts",
          direction: "column",
          splitPercentage: 38.13953488372094,
        },
        direction: "column",
        splitPercentage: 39.436619718309856,
      },
      direction: "row",
      splitPercentage: 54.556650246305416,
    },
    second: "onboarding.welcome!31b1ehz",
    direction: "row",
    splitPercentage: 64.34231378763867,
  },
  configById: {
    "ImageViewPanel!4evmpi6": {
      cameraTopic: "/image_color/compressed",
      enabledMarkerTopics: [],
      customMarkerTopicOptions: [],
      scale: 0.2,
      transformMarkers: true,
      synchronize: false,
      mode: "fit",
      zoomPercentage: 31.5,
      offset: [0, 3.3599999999999994],
    },
    "3D Panel!3vhcz8n": {
      checkedKeys: ["name:Topics", "t:/velodyne_points"],
      expandedKeys: ["name:Topics", "t:/tf"],
      followTf: "velodyne",
      cameraState: {
        targetOffset: [9.800968915027243, -0.39746626592445156, 0],
        thetaOffset: 1.5747779692579127,
        distance: 28.670626445812008,
        perspective: true,
        phi: 1.2421052631578948,
        fovy: 0.7853981633974483,
        near: 0.01,
        far: 5000,
        target: [0, 0, 0],
        targetOrientation: [0, 0, 0, 1],
      },
      modifiedNamespaceTopics: [],
      pinTopics: false,
      settingsByKey: {
        "t:/velodyne_points": {
          colorMode: {
            mode: "rainbow",
            colorField: "intensity",
          },
          pointShape: "circle",
          pointSize: 2,
        },
      },
      autoSyncCameraState: false,
      autoTextBackgroundColor: true,
    },
    "3D Panel!1ltsiud": {
      checkedKeys: ["t:/radar/points", "name:Topics"],
      expandedKeys: ["name:Topics"],
      followTf: "radar",
      cameraState: {
        targetOffset: [67.15015727440768, -0.347169127881074, 0],
        thetaOffset: 1.3309876595224308,
        distance: 180.38377740872997,
        perspective: false,
        phi: 1.1425294663062144,
        fovy: 0.7853981633974483,
        near: 0.01,
        far: 5000,
      },
      modifiedNamespaceTopics: [],
      pinTopics: false,
      settingsByKey: {
        "t:/radar/points": {
          pointSize: 4,
          pointShape: "square",
          colorMode: {
            mode: "flat",
            flatColor: {
              r: 0.2196078431372549,
              g: 1,
              b: 0,
              a: 1,
            },
          },
        },
      },
      autoSyncCameraState: false,
      autoTextBackgroundColor: true,
    },
    "Plot!2srxf7j": {
      paths: [
        {
          value: "/radar/tracks.tracks[:]{number==$track_id}.accel",
          enabled: true,
          timestampMethod: "receiveTime",
        },
        {
          value: "/radar/tracks.tracks[:]{number==$track_id}.rate",
          enabled: true,
          timestampMethod: "receiveTime",
        },
      ],
      minYValue: "",
      maxYValue: "",
      showLegend: false,
      xAxisVal: "timestamp",
    },
    "StateTransitions!3v5kkkn": {
      paths: [
        {
          value: "/radar/tracks.tracks[:]{number==$track_id}.moving",
          timestampMethod: "receiveTime",
        },
        {
          value: "/radar/tracks.tracks[:]{number==$track_id}.status",
          timestampMethod: "receiveTime",
        },
      ],
    },
    "DiagnosticStatusPanel!2yh7rts": {
      topicToRender: "/diagnostics",
      collapsedSections: [],
      selectedHardwareId: "Velodyne HDL-32E",
      splitFraction: 0.7048054919908466,
      selectedName: "velodyne_nodelet_manager: velodyne_packets topic status",
    },
  },
  globalVariables: {
    track_id: 34,
  },
  userNodes: {},
  linkedGlobalVariables: [],
  playbackConfig: {
    speed: 1,
    messageOrder: "receiveTime",
    timeDisplayMethod: "TOD",
  },
};

export default {
  name: "Welcome to Foxglove Studio",
  data,
};
