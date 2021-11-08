// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";

const builtin: PanelInfo[] = [
  { title: "3D", type: "3D Panel", module: async () => await import("./ThreeDimensionalViz") },
  {
    title: `Diagnostics – Detail`,
    type: "DiagnosticStatusPanel",
    module: async () => await import("./diagnostics/DiagnosticStatusPanel"),
  },
  {
    title: `Diagnostics – Summary`,
    type: "DiagnosticSummary",
    module: async () => await import("./diagnostics/DiagnosticSummary"),
  },
  { title: "Image", type: "ImageViewPanel", module: async () => await import("./ImageView") },
  { title: "Teleop", type: "Teleop", module: async () => await import("./Teleop") },
  { title: "Map", type: "map", module: async () => await import("./Map") },
  { title: "Parameters", type: "Parameters", module: async () => await import("./Parameters") },
  { title: "Plot", type: "Plot", module: async () => await import("./Plot") },
  { title: "Publish", type: "Publish", module: async () => await import("./Publish") },
  { title: "Raw Messages", type: "RawMessages", module: async () => await import("./RawMessages") },
  { title: "Log", type: "RosOut", module: async () => await import("./Log") },
  {
    title: "State Transitions",
    type: "StateTransitions",
    module: async () => await import("./StateTransitions"),
  },
  { title: "Table", type: "Table", module: async () => await import("./Table") },
  { title: "URDF Viewer", type: "URDFViewer", module: async () => await import("./URDFViewer") },
  { title: "Topic Graph", type: "TopicGraph", module: async () => await import("./TopicGraph") },
  {
    title: "Data Source Info",
    type: "SourceInfo",
    module: async () => await import("./SourceInfo"),
  },
  {
    title: "Variable Slider",
    type: "GlobalVariableSliderPanel",
    module: async () => await import("./GlobalVariableSlider"),
  },
  {
    title: "Node Playground",
    type: "NodePlayground",
    module: async () => await import("./NodePlayground"),
  },
  { title: "Tab", type: TAB_PANEL_TYPE, module: async () => await import("./Tab") },
];

const debug: PanelInfo[] = [
  {
    title: "Studio - Playback Performance",
    type: "PlaybackPerformance",
    module: async () => await import("./PlaybackPerformance"),
  },
  {
    title: "Studio - Internals",
    type: "Internals",
    module: async () => await import("./Internals"),
  },
  {
    title: "Studio - Logs",
    type: "InternalLogs",
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
    module: async () => await import("./LegacyPlot"),
  },
];

export default { builtin, debug, hidden, legacyPlot };
