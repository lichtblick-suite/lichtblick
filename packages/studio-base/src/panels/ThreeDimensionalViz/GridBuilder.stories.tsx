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
import styled from "styled-components";

import { DEFAULT_CAMERA_STATE, Worldview } from "@foxglove/regl-worldview";
import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import { GridSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/GridSettingsEditor";
import GlLineLists from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/GlLineLists";
import { CoordinateFrame } from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import useTransforms from "@foxglove/studio-base/panels/ThreeDimensionalViz/useTransforms";
import {
  ArrowMarker,
  ColorMarker,
  CubeListMarker,
  CubeMarker,
  CylinderMarker,
  GlLineListMarker,
  InstancedLineListMarker,
  LineListMarker,
  LineStripMarker,
  MeshMarker,
  OccupancyGridMessage,
  PointCloud,
  PointsMarker,
  SphereListMarker,
  SphereMarker,
  TextMarker,
  TriangleListMarker,
} from "@foxglove/studio-base/types/Messages";
import { FOXGLOVE_GRID_TOPIC } from "@foxglove/studio-base/util/globalConstants";

import GridBuilder from "./GridBuilder";
import { MarkerCollector } from "./types";

const SExpectedResult = styled.div`
  position: fixed;
  top: 25px;
  left: 0;
  color: lightgreen;
  margin: 16px;
  z-index: 1000;
`;

class MockMarkerCollector implements MarkerCollector {
  public data = {
    glLineList: [] as GlLineListMarker[],
  };

  public arrow(_arg0: ArrowMarker): void {}
  public color(_arg0: ColorMarker): void {}
  public cube(_arg0: CubeMarker): void {}
  public cubeList(_arg0: CubeListMarker): void {}
  public sphere(_arg0: SphereMarker): void {}
  public sphereList(_arg0: SphereListMarker): void {}
  public cylinder(_arg0: CylinderMarker): void {}
  public poseMarker(): void {}
  public lineStrip(_arg0: LineStripMarker): void {}
  public lineList(_arg0: LineListMarker): void {}
  public points(_arg0: PointsMarker): void {}
  public text(_arg0: TextMarker): void {}
  public mesh(_arg0: MeshMarker): void {}
  public triangleList(_arg0: TriangleListMarker): void {}
  public grid(_arg0: OccupancyGridMessage): void {}
  public pointcloud(_arg0: PointCloud): void {}
  public linedConvexHull(_arg0: LineListMarker | LineStripMarker): void {}
  public instancedLineList(_arg0: InstancedLineListMarker): void {}
  public glLineList(arg0: Readonly<{ color: Float32Array; points: Float32Array }>): void {
    this.data.glLineList.push(arg0);
  }
}

const renderFrame = new CoordinateFrame("map", undefined);
const fixedFrame = renderFrame;

storiesOf("panels/ThreeDimensionalViz/GridBuilder", module)
  .add("renders the default grid", () => {
    const transforms = useTransforms({
      topics: [],
      frame: {},
      reset: false,
      urdfTransforms: [],
    });
    const collector = new MockMarkerCollector();
    const gridBuilder = new GridBuilder();
    gridBuilder.renderMarkers({
      add: collector,
      renderFrame,
      fixedFrame,
      transforms,
      time: { sec: 0, nsec: 0 },
    });

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
          <GlLineLists glLineLists={collector.data.glLineList} />
        </Worldview>
        <SExpectedResult>A 10x10 grid should be rendered</SExpectedResult>
      </div>
    );
  })
  .add("renders a customized grid", () => {
    const transforms = useTransforms({ topics: [], frame: {}, reset: false, urdfTransforms: [] });
    const collector = new MockMarkerCollector();
    const gridBuilder = new GridBuilder();
    const settings: GridSettings = {
      heightOffset: -3,
      overrideColor: { r: 1, g: 0, b: 1, a: 1 },
      subdivisions: 0,
      width: 5,
    };
    const topicSettings: TopicSettingsCollection = {};
    topicSettings[`t:${FOXGLOVE_GRID_TOPIC}`] = settings;
    gridBuilder.setSettingsByKey(topicSettings);
    gridBuilder.renderMarkers({
      add: collector,
      renderFrame,
      fixedFrame,
      transforms,
      time: { sec: 0, nsec: 0 },
    });

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
          <GlLineLists glLineLists={collector.data.glLineList} />
        </Worldview>
        <SExpectedResult>A magenta rectangle should be rendered, offset down</SExpectedResult>
      </div>
    );
  });
