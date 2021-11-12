// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";

import GlobalVariableSliderHelp from "./GlobalVariableSlider/index.help.md";
import ImageViewHelp from "./ImageView/index.help.md";
import InternalLogsHelp from "./InternalLogs/index.help.md";
import InternalsHelp from "./Internals/index.help.md";
import LogHelp from "./Log/index.help.md";
import MapHelp from "./Map/index.help.md";
import NodePlaygroundHelp from "./NodePlayground/index.help.md";
import ParametersHelp from "./Parameters/index.help.md";
import PlaybackPerformanceHelp from "./PlaybackPerformance/index.help.md";
import PlotHelp from "./Plot/index.help.md";
import PublishHelp from "./Publish/index.help.md";
import RawMessagesHelp from "./RawMessages/index.help.md";
import SourceInfoHelp from "./SourceInfo/index.help.md";
import StateTransitionsHelp from "./StateTransitions/index.help.md";
import TabHelp from "./Tab/index.help.md";
import TableHelp from "./Table/index.help.md";
import TeleopHelp from "./Teleop/index.help.md";
import ThreeDimensionalVizHelp from "./ThreeDimensionalViz/index.help.md";
import TopicGraphHelp from "./TopicGraph/index.help.md";
import URDFViewerHelp from "./URDFViewer/index.help.md";
import DiagnosticStatusPanelHelp from "./diagnostics/DiagnosticStatusPanel.help.md";
import DiagnosticSummaryHelp from "./diagnostics/DiagnosticSummary.help.md";

const builtin: PanelInfo[] = [
  {
    title: "3D",
    type: "3D Panel",
    help: ThreeDimensionalVizHelp,
    module: async () => await import("./ThreeDimensionalViz"),
  },
  {
    title: `Diagnostics – Detail`,
    type: "DiagnosticStatusPanel",
    help: DiagnosticStatusPanelHelp,
    module: async () => await import("./diagnostics/DiagnosticStatusPanel"),
  },
  {
    title: `Diagnostics – Summary`,
    type: "DiagnosticSummary",
    help: DiagnosticSummaryHelp,
    module: async () => await import("./diagnostics/DiagnosticSummary"),
  },
  {
    title: "Image",
    type: "ImageViewPanel",
    help: ImageViewHelp,
    module: async () => await import("./ImageView"),
  },
  {
    title: "Teleop",
    type: "Teleop",
    help: TeleopHelp,
    module: async () => await import("./Teleop"),
  },
  { title: "Map", type: "map", help: MapHelp, module: async () => await import("./Map") },
  {
    title: "Parameters",
    type: "Parameters",
    help: ParametersHelp,
    module: async () => await import("./Parameters"),
  },
  { title: "Plot", type: "Plot", help: PlotHelp, module: async () => await import("./Plot") },
  {
    title: "Publish",
    type: "Publish",
    help: PublishHelp,
    module: async () => await import("./Publish"),
  },
  {
    title: "Raw Messages",
    type: "RawMessages",
    help: RawMessagesHelp,
    module: async () => await import("./RawMessages"),
  },
  { title: "Log", type: "RosOut", help: LogHelp, module: async () => await import("./Log") },
  {
    title: "State Transitions",
    type: "StateTransitions",
    help: StateTransitionsHelp,
    module: async () => await import("./StateTransitions"),
  },
  { title: "Table", type: "Table", help: TableHelp, module: async () => await import("./Table") },
  {
    title: "URDF Viewer",
    type: "URDFViewer",
    help: URDFViewerHelp,
    module: async () => await import("./URDFViewer"),
  },
  {
    title: "Topic Graph",
    type: "TopicGraph",
    help: TopicGraphHelp,
    module: async () => await import("./TopicGraph"),
  },
  {
    title: "Data Source Info",
    type: "SourceInfo",
    help: SourceInfoHelp,
    module: async () => await import("./SourceInfo"),
  },
  {
    title: "Variable Slider",
    type: "GlobalVariableSliderPanel",
    help: GlobalVariableSliderHelp,
    module: async () => await import("./GlobalVariableSlider"),
  },
  {
    title: "Node Playground",
    type: "NodePlayground",
    help: NodePlaygroundHelp,
    module: async () => await import("./NodePlayground"),
  },
  { title: "Tab", type: TAB_PANEL_TYPE, help: TabHelp, module: async () => await import("./Tab") },
];

const debug: PanelInfo[] = [
  {
    title: "Studio - Playback Performance",
    type: "PlaybackPerformance",
    help: PlaybackPerformanceHelp,
    module: async () => await import("./PlaybackPerformance"),
  },
  {
    title: "Studio - Internals",
    type: "Internals",
    help: InternalsHelp,
    module: async () => await import("./Internals"),
  },
  {
    title: "Studio - Logs",
    type: "InternalLogs",
    help: InternalLogsHelp,
    module: async () => await import("./InternalLogs"),
  },
];

const hidden: PanelInfo[] = [
  {
    title: "Welcome",
    type: "onboarding.welcome",
    module: async () => await import("./WelcomePanel"),
  },
];

const legacyPlot: PanelInfo[] = [
  { title: "Legacy Plot", type: "LegacyPlot", module: async () => await import("./LegacyPlot") },
];

export default { builtin, debug, hidden, legacyPlot };
