// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { storiesOf } from "@storybook/react";
import { noop } from "lodash";
import { DEFAULT_CAMERA_STATE, Lines, Worldview } from "regl-worldview";
import styled from "styled-components";

import { TopicSettingsCollection } from "@foxglove-studio/app/panels/ThreeDimensionalViz/SceneBuilder";
import { GridSettings } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicSettingsEditor/GridSettingsEditor";
import {
  ArrowMarker,
  CubeListMarker,
  CubeMarker,
  CylinderMarker,
  FilledPolygonMarker,
  InstancedLineListMarker,
  LaserScan,
  LineListMarker,
  LineStripMarker,
  OccupancyGridMessage,
  OverlayIconMarker,
  PointCloud,
  PointsMarker,
  SphereListMarker,
  SphereMarker,
  TextMarker,
  TriangleListMarker,
} from "@foxglove-studio/app/types/Messages";
import { MarkerCollector } from "@foxglove-studio/app/types/Scene";
import { FOXGLOVE_GRID_TOPIC } from "@foxglove-studio/app/util/globalConstants";

import GridBuilder from "./GridBuilder";

const SExpectedResult = styled.div`
  position: fixed;
  top: 25px;
  left: 0;
  color: lightgreen;
  margin: 16px;
  z-index: 1000;
`;

class MockMarkerCollector implements MarkerCollector {
  data = {
    instancedLineList: [] as InstancedLineListMarker[],
  };

  arrow(_arg0: ArrowMarker): any {}
  cube(_arg0: CubeMarker): any {}
  cubeList(_arg0: CubeListMarker): any {}
  sphere(_arg0: SphereMarker): any {}
  sphereList(_arg0: SphereListMarker): any {}
  cylinder(_arg0: CylinderMarker): any {}
  poseMarker(_arg0: ArrowMarker): any {}
  lineStrip(_arg0: LineStripMarker): any {}
  lineList(_arg0: LineListMarker): any {}
  points(_arg0: PointsMarker): any {}
  text(_arg0: TextMarker): any {}
  triangleList(_arg0: TriangleListMarker): any {}
  grid(_arg0: OccupancyGridMessage): any {}
  pointcloud(_arg0: PointCloud): any {}
  laserScan(_arg0: LaserScan): any {}
  linedConvexHull(_arg0: LineListMarker | LineStripMarker): any {}
  filledPolygon(_arg0: FilledPolygonMarker): any {}
  instancedLineList(arg0: InstancedLineListMarker): any {
    this.data.instancedLineList.push(arg0);
  }
  overlayIcon(_arg0: OverlayIconMarker): any {}
}

storiesOf("<3DViz> / GridBuilder", module)
  .add("renders the default grid", () => {
    const collector = new MockMarkerCollector();
    const gridBuilder = new GridBuilder();
    gridBuilder.renderMarkers(collector);

    return (
      <div style={{ width: 640, height: 480 }}>
        <Worldview
          onClick={noop}
          onCameraStateChange={noop}
          cameraState={{ ...DEFAULT_CAMERA_STATE, distance: 15 }}
          onDoubleClick={noop}
          onMouseDown={noop}
          onMouseMove={noop}
          onMouseUp={noop}
        >
          <Lines>{collector.data.instancedLineList}</Lines>
        </Worldview>
        <SExpectedResult>A 10x10 grid should be rendered</SExpectedResult>
      </div>
    );
  })
  .add("renders a customized grid", () => {
    const collector = new MockMarkerCollector();
    const gridBuilder = new GridBuilder();
    const settings: GridSettings = {
      heightOffset: -3,
      lineWidth: 3,
      overrideColor: { r: 1, g: 0, b: 1, a: 1 },
      subdivisions: 0,
      width: 5,
    };
    const topicSettings: TopicSettingsCollection = {};
    topicSettings[`t:${FOXGLOVE_GRID_TOPIC}`] = settings;
    gridBuilder.setSettingsByKey(topicSettings);
    gridBuilder.renderMarkers(collector);

    return (
      <div style={{ width: 640, height: 480 }}>
        <Worldview
          onClick={noop}
          onCameraStateChange={noop}
          cameraState={{ ...DEFAULT_CAMERA_STATE, distance: 15 }}
          onDoubleClick={noop}
          onMouseDown={noop}
          onMouseMove={noop}
          onMouseUp={noop}
        >
          <Lines>{collector.data.instancedLineList}</Lines>
        </Worldview>
        <SExpectedResult>
          A magenta rectangle with thick lines should be rendered, offset down
        </SExpectedResult>
      </div>
    );
  });
