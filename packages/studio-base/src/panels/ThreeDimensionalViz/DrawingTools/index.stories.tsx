// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { storiesOf } from "@storybook/react";
import { CSSProperties } from "react";

import { PolygonBuilder } from "@foxglove/regl-worldview";
import { pointsToPolygons } from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/drawToolUtils";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import DrawingTools, { POLYGON_TAB_TYPE } from "./index";

const polygons = pointsToPolygons([
  [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ],
  [
    { x: 4, y: 4 },
    { x: 5, y: 5 },
    { x: 6, y: 6 },
  ],
]);

const containerStyle: CSSProperties = {
  padding: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  backgroundColor: colors.DARK,
  height: "100%",
};

const DEFAULT_PROPS = {
  expanded: true,
  onAlignXYAxis: () => {
    // no-op
  },
  onExpand: () => {
    // no-op
  },
  onSetDrawingTabType: () => {
    // no-op
  },
  onSetPolygons: () => {
    // no-op
  },
  polygonBuilder: new PolygonBuilder(polygons),
  saveConfig: () => {
    // no-op
  },
  type: POLYGON_TAB_TYPE,
  updatePanelConfig: () => {
    // no-op
  },
  showForTests: true,
};

storiesOf("panels/ThreeDimensionalViz/DrawingTools", module).add("Polygon", () => {
  return (
    <div style={containerStyle}>
      <div style={{ margin: 8 }}>
        <DrawingTools {...DEFAULT_PROPS} defaultSelectedTab={POLYGON_TAB_TYPE} />
      </div>
      <div style={{ margin: 8 }}>
        <DrawingTools {...DEFAULT_PROPS} defaultSelectedTab={POLYGON_TAB_TYPE} />
      </div>
    </div>
  );
});
