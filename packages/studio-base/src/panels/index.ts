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
    description: "Display visualization markers and models in a 3D scene.",
    help: ThreeDimensionalVizHelp,
    module: async () => await import("./ThreeDimensionalViz"),
  },
  {
    title: `Diagnostics – Detail`,
    type: "DiagnosticStatusPanel",
    description: "Display data for a given diagnostics node.",
    help: DiagnosticStatusPanelHelp,
    module: async () => await import("./diagnostics/DiagnosticStatusPanel"),
  },
  {
    title: `Diagnostics – Summary`,
    type: "DiagnosticSummary",
    description: "Display the status of diagnostics nodes.",
    help: DiagnosticSummaryHelp,
    module: async () => await import("./diagnostics/DiagnosticSummary"),
  },
  {
    title: "Image",
    type: "ImageViewPanel",
    description: "Display camera feed images.",
    help: ImageViewHelp,
    module: async () => await import("./ImageView"),
  },
  {
    title: "Teleop",
    type: "Teleop",
    description: "Teleoperate a robot over a live connection.",
    help: TeleopHelp,
    module: async () => await import("./Teleop"),
  },
  {
    title: "Map",
    type: "map",
    description: "Display points on a map.",
    help: MapHelp,
    module: async () => await import("./Map"),
  },
  {
    title: "Parameters",
    type: "Parameters",
    description: "Read and set parameters for a data source.",
    help: ParametersHelp,
    module: async () => await import("./Parameters"),
  },
  {
    title: "Plot",
    type: "Plot",
    description: "Plot numerical values over time or other values.",
    help: PlotHelp,
    module: async () => await import("./Plot"),
  },
  {
    title: "Publish",
    type: "Publish",
    description: "Publish data over a life connection.",
    help: PublishHelp,
    module: async () => await import("./Publish"),
  },
  {
    title: "Raw Messages",
    type: "RawMessages",
    description: "Display topic messages as JSON.",
    help: RawMessagesHelp,
    module: async () => await import("./RawMessages"),
  },
  {
    title: "Log",
    type: "RosOut",
    description: "Display logs by node and severity level.",
    help: LogHelp,
    module: async () => await import("./Log"),
  },
  {
    title: "State Transitions",
    type: "StateTransitions",
    description: "Track when values change over time.",
    help: StateTransitionsHelp,
    module: async () => await import("./StateTransitions"),
  },
  {
    title: "Table",
    type: "Table",
    description: "Display topic messages in a tabular format.",
    help: TableHelp,
    module: async () => await import("./Table"),
  },
  {
    title: "URDF Viewer",
    type: "URDFViewer",
    description: "Visualize Unified Robot Description Format files.",
    help: URDFViewerHelp,
    module: async () => await import("./URDFViewer"),
  },
  {
    title: "Topic Graph",
    type: "TopicGraph",
    description: "Display a graph of active nodes, topics, and services.",
    help: TopicGraphHelp,
    module: async () => await import("./TopicGraph"),
  },
  {
    title: "Data Source Info",
    type: "SourceInfo",
    description: "View time and topic information for the data source.",
    help: SourceInfoHelp,
    module: async () => await import("./SourceInfo"),
  },
  {
    title: "Variable Slider",
    type: "GlobalVariableSliderPanel",
    description: "Quickly update numerical variable values for a layout.",
    help: GlobalVariableSliderHelp,
    module: async () => await import("./GlobalVariableSlider"),
  },
  {
    title: "Node Playground",
    type: "NodePlayground",
    description: "Write custom data transformations in TypeScript.",
    help: NodePlaygroundHelp,
    module: async () => await import("./NodePlayground"),
  },
  {
    title: "Tab",
    type: TAB_PANEL_TYPE,
    description: "Group related panels into tabs.",
    help: TabHelp,
    module: async () => await import("./Tab"),
  },
];

const debug: PanelInfo[] = [
  {
    title: "Studio - Playback Performance",
    type: "PlaybackPerformance",
    description: "Display playback and data-streaming performance statistics.",
    help: PlaybackPerformanceHelp,
    module: async () => await import("./PlaybackPerformance"),
  },
  {
    title: "Studio - Internals",
    type: "Internals",
    description: "View data publishers and subscribers, and record data for testing.",
    help: InternalsHelp,
    module: async () => await import("./Internals"),
  },
  {
    title: "Studio - Logs",
    type: "InternalLogs",
    description: "Specify the channels of internal logs to display for debugging.",
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
  {
    title: "Legacy Plot",
    type: "LegacyPlot",
    description: "Specify the channels of internal logs to display for debugging.",
    module: async () => await import("./LegacyPlot"),
  },
];

export default { builtin, debug, hidden, legacyPlot };
