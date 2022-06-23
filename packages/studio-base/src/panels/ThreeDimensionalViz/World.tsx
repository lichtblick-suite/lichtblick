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

import { getColorFromString } from "@fluentui/react";
import { forwardRef, useMemo, useRef } from "react";

import {
  Worldview,
  CameraState,
  MouseHandler,
  DEFAULT_CAMERA_STATE,
} from "@foxglove/regl-worldview";
import { Time } from "@foxglove/rostime";
import { Interactive } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import {
  WorldSearchTextParams,
  useGLText,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/SearchText";
import WorldMarkers, {
  InteractiveMarkersByType,
  MarkerWithInteractionData,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/WorldMarkers";
import { LoadModelOptions } from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/MeshMarkers";
import { LAYER_INDEX_DEFAULT_BASE } from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import {
  IImmutableCoordinateFrame,
  IImmutableTransformTree,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import {
  BaseMarker,
  ColorMarker,
  CubeListMarker,
  CubeMarker,
  CylinderMarker,
  GlLineListMarker,
  LineListMarker,
  LineStripMarker,
  MeshMarker,
  PointsMarker,
  SphereListMarker,
  SphereMarker,
  TextMarker,
} from "@foxglove/studio-base/types/Messages";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

import { MarkerCollector, MarkerProvider } from "./types";
import withHighlights from "./withHighlights";

type Props = WorldSearchTextParams & {
  autoTextBackgroundColor: boolean;
  canvasBackgroundColor: string;
  cameraState: CameraState;
  children?: React.ReactNode;
  isPlaying: boolean;
  transforms: IImmutableTransformTree;
  renderFrame: IImmutableCoordinateFrame;
  fixedFrame: IImmutableCoordinateFrame;
  currentTime: Time;
  markerProviders: MarkerProvider[];
  onCameraStateChange: (arg0: CameraState) => void;
  onClick: MouseHandler;
  onDoubleClick: MouseHandler;
  onMouseDown?: MouseHandler;
  onMouseMove?: MouseHandler;
  onMouseUp?: MouseHandler;
  loadModelOptions: LoadModelOptions;
};

function getMarkers({
  markers,
  markerProviders,
  transforms,
  renderFrame,
  fixedFrame,
  time,
}: {
  markers: InteractiveMarkersByType;
  markerProviders: MarkerProvider[];
  transforms: IImmutableTransformTree;
  renderFrame: IImmutableCoordinateFrame;
  fixedFrame: IImmutableCoordinateFrame;
  time: Time;
}): void {
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
    linedConvexHull: (o) =>
      markers.linedConvexHull.push(o as unknown as Interactive<LineListMarker | LineStripMarker>),
    lineList: (o) => markers.lineList.push(o as Interactive<LineListMarker>),
    lineStrip: (o) => markers.lineStrip.push(o as Interactive<LineStripMarker>),
    mesh: (o) => markers.mesh.push(o as Interactive<MeshMarker>),
    pointcloud: (o) => markers.pointcloud.push(o as unknown as Interactive<SphereMarker>),
    points: (o) => markers.points.push(o as Interactive<PointsMarker>),
    poseMarker: (o) => markers.poseMarker.push(o as Interactive<typeof o>),
    sphere: (o) => markers.sphere.push(o as Interactive<SphereMarker>),
    sphereList: (o) => markers.sphereList.push(o as Interactive<SphereListMarker>),
    text: (o) => markers.text.push(o as Interactive<TextMarker>),
    triangleList: (o) => markers.triangleList.push(o as unknown as MarkerWithInteractionData),
    glLineList: (o) => markers.glLineList.push(o as Interactive<GlLineListMarker>),
  };

  const args = { add: collector, transforms, renderFrame, fixedFrame, time };
  for (const provider of markerProviders) {
    provider.renderMarkers(args);
  }
}

// Wrap the WorldMarkers in HoC(s)
const WrappedWorldMarkers = withHighlights(WorldMarkers);

function World(
  {
    onClick,
    autoTextBackgroundColor,
    canvasBackgroundColor,
    children,
    onCameraStateChange,
    cameraState,
    isPlaying,
    transforms,
    renderFrame,
    fixedFrame,
    currentTime,
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
    loadModelOptions,
  }: Props,
  ref: typeof Worldview,
) {
  // Building these arrays every frame is expensive, so we instantiate once and
  // clear them each time to reduce allocations
  const markersRef = useRef<InteractiveMarkersByType | undefined>(undefined);
  markersRef.current ??= {
    arrow: [],
    color: [],
    cube: [],
    cubeList: [],
    cylinder: [],
    glText: [],
    grid: [],
    instancedLineList: [],
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
    glLineList: [],
  };
  for (const key in markersRef.current) {
    (markersRef.current as Record<string, unknown[]>)[key]!.length = 0;
  }

  getMarkers({
    markers: markersRef.current,
    markerProviders,
    transforms,
    renderFrame,
    fixedFrame,
    time: currentTime,
  });

  const markersByType = markersRef.current;
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

  const backgroundColor = useMemo(() => {
    const { r, g, b, a } = getColorFromString(canvasBackgroundColor) ?? { r: 0, g: 0, b: 0, a: 1 };
    return [r / 255, g / 255, b / 255, (a ?? 100) / 100];
  }, [canvasBackgroundColor]);

  return (
    <Worldview
      backgroundColor={backgroundColor}
      cameraState={cameraState}
      enableStackedObjectEvents={!isPlaying}
      hideDebug={inScreenshotTests()}
      onCameraStateChange={onCameraStateChange}
      // Rendering the hitmap is an expensive operation and we want to avoid
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
          cameraDistance:
            mightActuallyBePartial(cameraState).distance ?? DEFAULT_CAMERA_STATE.distance,
          loadModelOptions,
        }}
      />
    </Worldview>
  );
}

export default forwardRef<typeof Worldview, Props>(World);
