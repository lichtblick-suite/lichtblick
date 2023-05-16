// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { TFunction } from "i18next";

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
import variableSliderThumbnail from "./VariableSlider/thumbnail.png";
import diagnosticStatusThumbnail from "./diagnostics/thumbnails/diagnostic-status.png";
import diagnosticSummaryThumbnail from "./diagnostics/thumbnails/diagnostic-summary.png";

export const getBuiltin: (t: TFunction<"panels">) => PanelInfo[] = (t) => [
  {
    title: t("3D"),
    type: "3D",
    description: t("3DPanelDescription"),
    thumbnail: threeDeeRenderThumbnail,
    module: async () => ({ default: (await import("./ThreeDeeRender")).ThreeDeePanel }),
  },
  {
    title: t("ROSDiagnosticsDetail"),
    type: "DiagnosticStatusPanel",
    description: t("ROSDiagnosticsDetailDescription"),
    thumbnail: diagnosticStatusThumbnail,
    module: async () => await import("./diagnostics/DiagnosticStatusPanel"),
    hasCustomToolbar: true,
  },
  {
    title: t("ROSDiagnosticSummary"),
    type: "DiagnosticSummary",
    description: t("ROSDiagnosticSummaryDescription"),
    thumbnail: diagnosticSummaryThumbnail,
    module: async () => await import("./diagnostics/DiagnosticSummary"),
    hasCustomToolbar: true,
  },
  {
    title: t("newImage"),
    type: "Image",
    description: t("imageDescription"),
    thumbnail: imageViewThumbnail,
    module: async () => ({ default: (await import("./ThreeDeeRender")).ImagePanel }),
  },
  {
    title: t("image"),
    type: "ImageViewPanel",
    description: t("imageDescription"),
    thumbnail: imageViewThumbnail,
    module: async () => await import("./Image"),
  },
  {
    title: t("indicator"),
    type: "Indicator",
    description: t("indicatorDescription"),
    thumbnail: indicatorThumbnail,
    module: async () => await import("./Indicator"),
  },
  {
    title: t("gauge"),
    type: "Gauge",
    description: t("gaugeDescription"),
    thumbnail: gaugeThumbnail,
    module: async () => await import("./Gauge"),
  },
  {
    title: t("teleop"),
    type: "Teleop",
    description: t("teleopDescription"),
    thumbnail: teleopThumbnail,
    module: async () => await import("./Teleop"),
  },
  {
    title: t("map"),
    type: "map",
    description: t("mapDescription"),
    thumbnail: mapThumbnail,
    module: async () => await import("./Map"),
  },
  {
    title: t("parameters"),
    type: "Parameters",
    description: t("parametersDescription"),
    thumbnail: parametersThumbnail,
    module: async () => await import("./Parameters"),
  },
  {
    title: t("plot"),
    type: "Plot",
    description: t("plotDescription"),
    thumbnail: plotThumbnail,
    module: async () => await import("./Plot"),
  },
  {
    title: t("publish"),
    type: "Publish",
    description: t("publishDescription"),
    thumbnail: publishThumbnail,
    module: async () => await import("./Publish"),
  },
  {
    title: t("rawMessages"),
    type: "RawMessages",
    description: t("rawMessagesDescription"),
    thumbnail: rawMessagesThumbnail,
    module: async () => await import("./RawMessages"),
    hasCustomToolbar: true,
  },
  {
    title: t("log"),
    type: "RosOut",
    description: t("logDescription"),
    thumbnail: logThumbnail,
    module: async () => await import("./Log"),
    hasCustomToolbar: true,
  },
  {
    title: t("stateTransitions"),
    type: "StateTransitions",
    description: t("stateTransitionsDescription"),
    thumbnail: stateTransitionsThumbnail,
    module: async () => await import("./StateTransitions"),
  },
  {
    title: t("table"),
    type: "Table",
    description: t("tableDescription"),
    thumbnail: tableThumbnail,
    module: async () => await import("./Table"),
    hasCustomToolbar: true,
  },
  {
    title: t("topicGraph"),
    type: "TopicGraph",
    description: t("topicGraphDescription"),
    thumbnail: topicGraphThumbnail,
    module: async () => await import("./TopicGraph"),
  },
  {
    title: t("dataSourceInfo"),
    type: "SourceInfo",
    description: t("dataSourceInfoDescription"),
    thumbnail: dataSourceInfoThumbnail,
    module: async () => await import("./DataSourceInfo"),
  },
  {
    title: t("variableSlider"),
    type: "GlobalVariableSliderPanel",
    description: t("variableSliderDescription"),
    thumbnail: variableSliderThumbnail,
    module: async () => await import("./VariableSlider"),
  },
  {
    title: t("userScripts"),
    type: "NodePlayground",
    description: t("userScriptsDescription"),
    thumbnail: nodePlaygroundThumbnail,
    module: async () => await import("./NodePlayground"),
  },
  {
    title: t("tab"),
    type: TAB_PANEL_TYPE,
    description: t("tabDescription"),
    thumbnail: tabThumbnail,
    module: async () => await import("./Tab"),
    hasCustomToolbar: true,
  },
];

export const getDebug: (t: TFunction<"panels">) => PanelInfo[] = (t) => [
  {
    title: t("studioPlaybackPerformance"),
    type: "PlaybackPerformance",
    description: t("studioPlaybackPerformanceDescription"),
    module: async () => await import("./PlaybackPerformance"),
  },
];
