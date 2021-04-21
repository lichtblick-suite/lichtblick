// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  PanelCatalog,
  PanelCategory,
  PanelInfo,
} from "@foxglove-studio/app/context/PanelCatalogContext";
import GlobalVariableSlider from "@foxglove-studio/app/panels/GlobalVariableSlider";
import GlobalVariables from "@foxglove-studio/app/panels/GlobalVariables";
import ImageViewPanel from "@foxglove-studio/app/panels/ImageView";
import InternalLogs from "@foxglove-studio/app/panels/InternalLogs";
import Internals from "@foxglove-studio/app/panels/Internals";
import MapPanel from "@foxglove-studio/app/panels/Map";
import NodePlayground from "@foxglove-studio/app/panels/NodePlayground";
import NumberOfRenders from "@foxglove-studio/app/panels/NumberOfRenders";
import ParametersPanel from "@foxglove-studio/app/panels/Parameters";
import PlaybackPerformance from "@foxglove-studio/app/panels/PlaybackPerformance";
import Plot from "@foxglove-studio/app/panels/Plot";
import Publish from "@foxglove-studio/app/panels/Publish";
import RawMessages from "@foxglove-studio/app/panels/RawMessages";
import Rosout from "@foxglove-studio/app/panels/Rosout";
import SourceInfo from "@foxglove-studio/app/panels/SourceInfo";
import StateTransitions from "@foxglove-studio/app/panels/StateTransitions";
import SubscribeToList from "@foxglove-studio/app/panels/SubscribeToList";
import Tab from "@foxglove-studio/app/panels/Tab";
import Table from "@foxglove-studio/app/panels/Table";
import ThreeDimensionalViz from "@foxglove-studio/app/panels/ThreeDimensionalViz";
import TopicGraph from "@foxglove-studio/app/panels/TopicGraph";
import URDFViewer from "@foxglove-studio/app/panels/URDFViewer";
import WelcomePanel from "@foxglove-studio/app/panels/WelcomePanel";
import DiagnosticStatusPanel from "@foxglove-studio/app/panels/diagnostics/DiagnosticStatusPanel";
import DiagnosticSummary from "@foxglove-studio/app/panels/diagnostics/DiagnosticSummary";
import { ndash } from "@foxglove-studio/app/util/entities";

const ros: PanelInfo[] = [
  { title: "3D", component: ThreeDimensionalViz },
  { title: `Diagnostics ${ndash} Detail`, component: DiagnosticStatusPanel },
  { title: `Diagnostics ${ndash} Summary`, component: DiagnosticSummary },
  { title: "Image", component: ImageViewPanel },
  { title: "Map", component: MapPanel },
  { title: "Parameters", component: ParametersPanel },
  { title: "Plot", component: Plot },
  { title: "Publish", component: Publish },
  { title: "Raw Messages", component: RawMessages },
  { title: "rosout", component: Rosout },
  { title: "State Transitions", component: StateTransitions },
  { title: "Table", component: Table },
  { title: "URDF Viewer", component: URDFViewer },
  { title: "Topic Graph", component: TopicGraph },
];

const utilities: PanelInfo[] = [
  { title: "Data Source Info", component: SourceInfo },
  { title: "Global Variable Slider", component: GlobalVariableSlider },
  { title: "Global Variables", component: GlobalVariables },
  { title: "Node Playground", component: NodePlayground },
  { title: "Tab", component: Tab },
];

const debugging: PanelInfo[] = [
  { title: "Number of Renders", component: NumberOfRenders },
  { title: "Playback Performance", component: PlaybackPerformance },
  { title: "Studio Internals", component: Internals },
  { title: "Studio Logs", component: InternalLogs },
  { title: "Subscribe to List", component: SubscribeToList },
];

// Hidden panels are not present in panels by category or panel categories
// They are only accessible by type
const hidden = [{ title: "Welcome", component: WelcomePanel }];

// BuiltinPanelCatalog implements a PanelCatalog for all our builtin panels
class BuiltinPanelCatalog implements PanelCatalog {
  private _panelsByCategory: Map<string, PanelInfo[]>;
  private _panelsByType: Map<string, PanelInfo>;

  constructor() {
    this._panelsByCategory = new Map<string, PanelInfo[]>([
      ["ros", ros],
      ["utilities", utilities],
      ["debugging", debugging],
      ["hidden", hidden],
    ]);

    this._panelsByType = new Map<string, PanelInfo>();

    const panelsByCategory = this.getPanelsByCategory();
    for (const panels of panelsByCategory.values()) {
      for (const item of panels) {
        const panelType = item.component.panelType;
        this._panelsByType.set(panelType, item);
      }
    }
  }

  getPanelCategories(): PanelCategory[] {
    // hidden panels are not present in the display categories
    return [
      { label: "ROS", key: "ros" },
      { label: "Utilities", key: "utilities" },
      { label: "Debugging", key: "debugging" },
    ];
  }

  getPanelsByCategory(): Map<string, PanelInfo[]> {
    return this._panelsByCategory;
  }

  getComponentForType(type: string): PanelInfo["component"] | undefined {
    return this._panelsByType.get(type)?.component;
  }

  getPanelsByType(): Map<string, PanelInfo> {
    return this._panelsByType;
  }
}

export default BuiltinPanelCatalog;
