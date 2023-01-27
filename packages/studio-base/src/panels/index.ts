// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";

import dataSourceInfoThumbnail from "./DataSourceInfo/thumbnail.png";
import gaugeThumbnail from "./Gauge/thumbnail.png";
import imageViewThumbnail from "./Image/thumbnail.png";
import indicatorThumbnail from "./Indicator/thumbnail.png";
import logThumbnail from "./Log/thumbnail.png";
import mapThumbnail from "./Map/thumbnail.png";
import nodePlaygroundThumbnail from "./NodePlayground/thumbnail.png";
import parametersThumbnail from "./Parameters/thumbnail.png";
import plotThumbnail from "./Plot/thumbnail.png";
import publishThumbnail from "./Publish/thumbnail.png";
import rawMessagesThumbnail from "./RawMessages/thumbnail.png";
import stateTransitionsThumbnail from "./StateTransitions/thumbnail.png";
import tabThumbnail from "./Tab/thumbnail.png";
import tableThumbnail from "./Table/thumbnail.png";
import teleopThumbnail from "./Teleop/thumbnail.png";
import threeDeeRenderThumbnail from "./ThreeDeeRender/thumbnail.png";
import topicGraphThumbnail from "./TopicGraph/thumbnail.png";
import URDFViewerThumbnail from "./URDFViewer/thumbnail.png";
import variableSliderThumbnail from "./VariableSlider/thumbnail.png";
import diagnosticStatusThumbnail from "./diagnostics/thumbnails/diagnostic-status.png";
import diagnosticSummaryThumbnail from "./diagnostics/thumbnails/diagnostic-summary.png";

const builtin: PanelInfo[] = [
  {
    title: "3D",
    type: "3D",
    description: "Display markers, camera images, meshes, URDFs, and more in a 3D scene.",
    thumbnail: threeDeeRenderThumbnail,
    module: async () => await import("./ThreeDeeRender"),
    settingsOnboardingTooltip: "Open settings to configure topics and layers.",
  },
  {
    title: `Diagnostics – Detail (ROS)`,
    type: "DiagnosticStatusPanel",
    description: "Display ROS DiagnosticArray messages for a specific hardware_id.",
    thumbnail: diagnosticStatusThumbnail,
    module: async () => await import("./diagnostics/DiagnosticStatusPanel"),
    hasCustomToolbar: true,
  },
  {
    title: `Diagnostics – Summary (ROS)`,
    type: "DiagnosticSummary",
    description: "Display a summary of all ROS DiagnosticArray messages.",
    thumbnail: diagnosticSummaryThumbnail,
    module: async () => await import("./diagnostics/DiagnosticSummary"),
    hasCustomToolbar: true,
  },
  {
    title: "Image",
    type: "ImageViewPanel",
    description: "Display annotated images.",
    thumbnail: imageViewThumbnail,
    module: async () => await import("./Image"),
  },
  {
    title: "Indicator",
    type: "Indicator",
    description: "Display a colored and/or textual indicator based on a threshold value.",
    thumbnail: indicatorThumbnail,
    module: async () => await import("./Indicator"),
  },
  {
    title: "Gauge",
    type: "Gauge",
    description: "Display a colored gauge based on a continuous value.",
    thumbnail: gaugeThumbnail,
    module: async () => await import("./Gauge"),
  },
  {
    title: "Teleop",
    type: "Teleop",
    description: "Teleoperate a robot over a live connection.",
    thumbnail: teleopThumbnail,
    module: async () => await import("./Teleop"),
  },
  {
    title: "Map",
    type: "map",
    description: "Display points on a map.",
    thumbnail: mapThumbnail,
    module: async () => await import("./Map"),
  },
  {
    title: "Parameters",
    type: "Parameters",
    description: "Read and set parameters for a data source.",
    thumbnail: parametersThumbnail,
    module: async () => await import("./Parameters"),
  },
  {
    title: "Plot",
    type: "Plot",
    description: "Plot numerical values over time or other values.",
    thumbnail: plotThumbnail,
    module: async () => await import("./Plot"),
  },
  {
    title: "Publish",
    type: "Publish",
    description: "Publish messages to the data source (live connections only).",
    thumbnail: publishThumbnail,
    module: async () => await import("./Publish"),
  },
  {
    title: "Raw Messages",
    type: "RawMessages",
    description: "Inspect topic messages.",
    thumbnail: rawMessagesThumbnail,
    module: async () => await import("./RawMessages"),
    hasCustomToolbar: true,
  },
  {
    title: "Log",
    type: "RosOut",
    description: "Display logs by node and severity level.",
    thumbnail: logThumbnail,
    module: async () => await import("./Log"),
    hasCustomToolbar: true,
  },
  {
    title: "State Transitions",
    type: "StateTransitions",
    description: "Track when values change over time.",
    thumbnail: stateTransitionsThumbnail,
    module: async () => await import("./StateTransitions"),
  },
  {
    title: "Table",
    type: "Table",
    description: "Display topic messages in a tabular format.",
    thumbnail: tableThumbnail,
    module: async () => await import("./Table"),
    hasCustomToolbar: true,
  },
  {
    title: "URDF Viewer",
    type: "URDFViewer",
    description: "Visualize Unified Robot Description Format files.",
    thumbnail: URDFViewerThumbnail,
    module: async () => await import("./URDFViewer"),
  },
  {
    title: "Topic Graph",
    type: "TopicGraph",
    description: "Display a graph of active nodes, topics, and services.",
    thumbnail: topicGraphThumbnail,
    module: async () => await import("./TopicGraph"),
  },
  {
    title: "Data Source Info",
    type: "SourceInfo",
    description: "View details like topics and timestamps for the current data source.",
    thumbnail: dataSourceInfoThumbnail,
    module: async () => await import("./DataSourceInfo"),
  },
  {
    title: "Variable Slider",
    type: "GlobalVariableSliderPanel",
    description: "Update numerical variable values for a layout.",
    thumbnail: variableSliderThumbnail,
    module: async () => await import("./VariableSlider"),
  },
  {
    title: "User Scripts",
    type: "NodePlayground",
    description:
      "Write custom data transformations in TypeScript. Previously known as Node Playground.",
    thumbnail: nodePlaygroundThumbnail,
    module: async () => await import("./NodePlayground"),
  },
  {
    title: "Tab",
    type: TAB_PANEL_TYPE,
    description: "Group related panels into tabs.",
    thumbnail: tabThumbnail,
    module: async () => await import("./Tab"),
  },
];

const debug: PanelInfo[] = [
  {
    title: "Studio - Playback Performance",
    type: "PlaybackPerformance",
    description: "Display playback and data-streaming performance statistics.",
    module: async () => await import("./PlaybackPerformance"),
  },
];

const legacyPlot: PanelInfo[] = [
  {
    title: "Legacy Plot",
    type: "LegacyPlot",
    module: async () => await import("./LegacyPlot"),
  },
];

export default { builtin, debug, legacyPlot };
