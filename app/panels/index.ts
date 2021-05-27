// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import GlobalVariableSlider from "./GlobalVariableSlider";
import ImageViewPanel from "./ImageView";
import InternalLogs from "./InternalLogs";
import Internals from "./Internals";
import MapPanel from "./Map";
import NodePlayground from "./NodePlayground";
import NumberOfRenders from "./NumberOfRenders";
import ParametersPanel from "./Parameters";
import PlaybackPerformance from "./PlaybackPerformance";
import Plot from "./Plot";
import Publish from "./Publish";
import RawMessages from "./RawMessages";
import Rosout from "./Rosout";
import SourceInfo from "./SourceInfo";
import StateTransitions from "./StateTransitions";
import SubscribeToList from "./SubscribeToList";
import Tab from "./Tab";
import Table from "./Table";
import ThreeDimensionalViz from "./ThreeDimensionalViz";
import TopicGraph from "./TopicGraph";
import URDFViewer from "./URDFViewer";
import WelcomePanel from "./WelcomePanel";
import DiagnosticStatusPanel from "./diagnostics/DiagnosticStatusPanel";
import DiagnosticSummary from "./diagnostics/DiagnosticSummary";

const builtin = [
  { title: "3D", component: ThreeDimensionalViz },
  { title: `Diagnostics – Detail`, component: DiagnosticStatusPanel },
  { title: `Diagnostics – Summary`, component: DiagnosticSummary },
  { title: "Image", component: ImageViewPanel },
  { title: "Map", component: MapPanel },
  { title: "Parameters", component: ParametersPanel },
  { title: "Plot", component: Plot },
  { title: "Publish", component: Publish },
  { title: "Raw Messages", component: RawMessages },
  { title: "Rosout", component: Rosout },
  { title: "State Transitions", component: StateTransitions },
  { title: "Table", component: Table },
  { title: "URDF Viewer", component: URDFViewer },
  { title: "Topic Graph", component: TopicGraph },
  { title: "Data Source Info", component: SourceInfo },
  { title: "Variable Slider", component: GlobalVariableSlider },
  { title: "Node Playground", component: NodePlayground },
  { title: "Tab", component: Tab },
];

const debug = [
  { title: "Studio - Number of Renders", component: NumberOfRenders },
  { title: "Studio - Playback Performance", component: PlaybackPerformance },
  { title: "Studio - Internals", component: Internals },
  { title: "Studio - Logs", component: InternalLogs },
  { title: "Studio - Subscribe to List", component: SubscribeToList },
];

const hidden = [{ title: "Welcome", component: WelcomePanel }];

export default { builtin, debug, hidden };
