// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Layout, LayoutID, ISO8601Timestamp } from "@foxglove/studio-base";

import DefaultMultipleThreeDee from "./layouts/DefaultMultipleThreeDee.json";
import Empty from "./layouts/Empty.json";
import PointcloudMultipleThreeDee from "./layouts/PointcloudMultipleThreeDee.json";
import PointcloudRawMessageAnd3d from "./layouts/PointcloudRawMessageAnd3d.json";
import SinewaveSinglePlot from "./layouts/SinewaveSinglePlot.json";

// Make a new Layout with the provided panel state
// The panel state is the .json file from an "export" on a layout
function panelStateJsonToLayout(id: string, name: string, state: unknown): Layout {
  return {
    id: id as LayoutID,
    name,
    permission: "CREATOR_WRITE",
    baseline: {
      data: state as NonNullable<Layout["baseline"]["data"]>,
      savedAt: new Date().toISOString() as ISO8601Timestamp,
    },
    working: undefined,
    syncInfo: undefined,
  };
}

const layouts = [
  panelStateJsonToLayout(
    "DefaultMultipleThreeDee",
    "Default - Multiple 3D",
    DefaultMultipleThreeDee,
  ),
  panelStateJsonToLayout("Empty", "Empty", Empty),
  panelStateJsonToLayout("SinewaveSinglePlot", "Sinewave - Single Plot", SinewaveSinglePlot),
  panelStateJsonToLayout(
    "PointcloudRawMessageAnd3d",
    "Pointcloud - Raw Message and 3D",
    PointcloudRawMessageAnd3d,
  ),
  panelStateJsonToLayout(
    "PointcloudMultipleThreeDee",
    "Pointcloud - Multiple 3D",
    PointcloudMultipleThreeDee,
  ),
];

const LAYOUTS = new Map<string, Layout>();
for (const layout of layouts) {
  LAYOUTS.set(layout.id, layout);
}

export { LAYOUTS };
