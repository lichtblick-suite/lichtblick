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

import { forwardRef } from "react";

import {
  Worldview,
  CameraState,
  MouseHandler,
  DEFAULT_CAMERA_STATE,
} from "@foxglove/regl-worldview";
import { Interactive } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import {
  WorldSearchTextProps,
  useGLText,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/SearchText";
import WorldMarkers, {
  InteractiveMarkersByType,
  MarkerWithInteractionData,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/WorldMarkers";
import { LAYER_INDEX_DEFAULT_BASE } from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import { withDiffMode } from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/diffModeUtils";
import withHighlights from "@foxglove/studio-base/panels/ThreeDimensionalViz/withHighlights";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import {
  BaseMarker,
  ColorMarker,
  CubeListMarker,
  CubeMarker,
  CylinderMarker,
  LineListMarker,
  LineStripMarker,
  MeshMarker,
  PointsMarker,
  SphereListMarker,
  SphereMarker,
  TextMarker,
} from "@foxglove/studio-base/types/Messages";
import { MarkerCollector, MarkerProvider } from "@foxglove/studio-base/types/Scene";

type Props = WorldSearchTextProps & {
  autoTextBackgroundColor: boolean;
  cameraState: CameraState;
  children?: React.ReactNode;
  isPlaying: boolean;
  markerProviders: MarkerProvider[];
  onCameraStateChange: (arg0: CameraState) => void;
  onClick: MouseHandler;
  onDoubleClick: MouseHandler;
  onMouseDown?: MouseHandler;
  onMouseMove?: MouseHandler;
  onMouseUp?: MouseHandler;
  diffModeEnabled: boolean;
};

function getMarkers(markerProviders: MarkerProvider[]): InteractiveMarkersByType {
  const markers: InteractiveMarkersByType = {
    arrow: [],
    color: [],
    cube: [],
    cubeList: [],
    cylinder: [],
    glText: [],
    grid: [],
    instancedLineList: [],
    laserScan: [],
    linedConvexHull: [],
    lineList: [],
    lineStrip: [],
    mesh: [],
    pointcloud: [],
    points: [],
    poseMarker: [],
    sphere: [],
    sphereList: [],
    text: [],
    triangleList: [],
  };

  // These casts seem wrong - some type definitions around MarkerProvider or MarkerCollector are not
  // compatible with interactive markers. Ideally interactive markers would not require mutating
  // marker objects which would help avoid unsafe casting.
  const collector: MarkerCollector = {
    arrow: (o) => markers.arrow.push(o as unknown as MarkerWithInteractionData),
    color: (o) => markers.color.push(o as Interactive<ColorMarker>),
    cube: (o) => markers.cube.push(o as Interactive<CubeMarker>),
    cubeList: (o) => markers.cubeList.push(o as Interactive<CubeListMarker>),
    cylinder: (o) => markers.cylinder.push(o as Interactive<CylinderMarker>),
    grid: (o) => markers.grid.push(o as unknown as Interactive<BaseMarker>),
    instancedLineList: (o) =>
      markers.instancedLineList.push(o as unknown as Interactive<BaseMarker>),
    laserScan: (o) => markers.laserScan.push(o as unknown as Interactive<BaseMarker>),
    linedConvexHull: (o) =>
      markers.linedConvexHull.push(o as unknown as Interactive<LineListMarker | LineStripMarker>),
    lineList: (o) => markers.lineList.push(o as Interactive<LineListMarker>),
    lineStrip: (o) => markers.lineStrip.push(o as Interactive<LineStripMarker>),
    mesh: (o) => markers.mesh.push(o as Interactive<MeshMarker>),
    pointcloud: (o) => markers.pointcloud.push(o as unknown as Interactive<SphereMarker>),
    points: (o) => markers.points.push(o as Interactive<PointsMarker>),
    poseMarker: (o) => markers.poseMarker.push(o as unknown as Interactive<BaseMarker>),
    sphere: (o) => markers.sphere.push(o as Interactive<SphereMarker>),
    sphereList: (o) => markers.sphereList.push(o as Interactive<SphereListMarker>),
    text: (o) => markers.text.push(o as Interactive<TextMarker>),
    triangleList: (o) => markers.triangleList.push(o as unknown as MarkerWithInteractionData),
  };

  for (const provider of markerProviders) {
    provider.renderMarkers(collector);
  }

  return markers;
}

// Wrap the WorldMarkers in HoC(s)
const WrappedWorldMarkers = withHighlights(withDiffMode(WorldMarkers));

function World(
  {
    onClick,
    autoTextBackgroundColor,
    children,
    onCameraStateChange,
    diffModeEnabled,
    cameraState,
    isPlaying,
    markerProviders,
    onDoubleClick,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    setSearchTextMatches,
    searchText,
    searchTextOpen,
    selectedMatchIndex,
    searchTextMatches,
  }: Props,
  ref: typeof Worldview,
) {
  const markersByType = getMarkers(markerProviders);
  const { text = [] } = markersByType;
  const processedMarkersByType = {
    ...markersByType,
    text: [],
    glText: useGLText({
      text,
      setSearchTextMatches,
      searchText,
      searchTextOpen,
      selectedMatchIndex,
      searchTextMatches,
    }),
  };

  return (
    <Worldview
      cameraState={cameraState}
      enableStackedObjectEvents={!isPlaying}
      hideDebug={inScreenshotTests()}
      onCameraStateChange={onCameraStateChange} // Rendering the hitmap is an expensive operation and we want to avoid
      // doing it when the user is dragging the view with the mouse. By ignoring
      // these events, the only way to select an object is when receiving an "onClick" event.
      disableHitmapForEvents={["onMouseDown", "onMouseMove", "onMouseUp"]}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      resolutionScale={1}
      ref={ref}
      contextAttributes={{ preserveDrawingBuffer: true }}
    >
      {children}
      <WrappedWorldMarkers
        {...{
          autoTextBackgroundColor,
          markersByType: processedMarkersByType,
          layerIndex: LAYER_INDEX_DEFAULT_BASE,
          clearCachedMarkers: false,
          cameraDistance: cameraState.distance ?? DEFAULT_CAMERA_STATE.distance,
          diffModeEnabled,
        }}
      />
    </Worldview>
  );
}

export default forwardRef<typeof Worldview, Props>(World);
