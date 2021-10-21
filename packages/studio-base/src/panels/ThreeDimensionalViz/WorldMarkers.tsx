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

import { useMemo, useState, useEffect } from "react";

import {
  Arrows,
  Cubes,
  Cylinders,
  GLText,
  Points,
  Spheres,
  Triangles,
  Lines,
  createInstancedGetChildrenForHitmap,
} from "@foxglove/regl-worldview";
import { Interactive } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { GLTextMarker } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SearchText";
import {
  Cover,
  OccupancyGrids,
  LaserScans,
  PointClouds,
  PoseMarkers,
  LinedConvexHulls,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands";
import MeshMarkers from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/MeshMarkers";
import {
  LAYER_INDEX_TEXT,
  LAYER_INDEX_OCCUPANCY_GRIDS,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import {
  BaseMarker,
  CubeListMarker,
  CubeMarker,
  CylinderMarker,
  LineListMarker,
  LineStripMarker,
  PointsMarker,
  SphereListMarker,
  SphereMarker,
  TextMarker,
  ColorMarker,
  MeshMarker,
} from "@foxglove/studio-base/types/Messages";
import { ReglColor } from "@foxglove/studio-base/util/colorUtils";

import glTextAtlasLoader, { TextAtlas } from "./utils/glTextAtlasLoader";
import { groupLinesIntoInstancedLineLists } from "./utils/groupingUtils";

export type MarkerWithInteractionData = Interactive<BaseMarker>;

export type InteractiveMarkersByType = {
  arrow: MarkerWithInteractionData[];
  color: Interactive<ColorMarker>[];
  cube: Interactive<CubeMarker>[];
  cubeList: Interactive<CubeListMarker>[];
  cylinder: Interactive<CylinderMarker>[];
  glText: Interactive<GLTextMarker>[];
  grid: Interactive<BaseMarker>[];
  instancedLineList: Interactive<BaseMarker>[];
  laserScan: Interactive<BaseMarker>[];
  linedConvexHull: Interactive<LineListMarker | LineStripMarker>[];
  lineList: Interactive<LineListMarker>[];
  lineStrip: Interactive<LineStripMarker>[];
  mesh: Interactive<MeshMarker>[];
  pointcloud: Interactive<SphereMarker>[];
  points: Interactive<PointsMarker>[];
  poseMarker: Interactive<BaseMarker>[];
  sphere: Interactive<SphereMarker>[];
  sphereList: Interactive<SphereListMarker>[];
  text: Interactive<TextMarker>[];
  triangleList: MarkerWithInteractionData[];
};

// Generate an alphabet for text makers with the most
// used ASCII characters to prevent recreating the texture
// atlas too many times for dynamic texts.
const ALPHABET = (() => {
  const start = 32; // SPACE
  const end = 125; // "}"
  return new Array(end - start + 1).fill(0).map((_, i) => String.fromCodePoint(start + i));
})();

const glTextAtlasPromise = glTextAtlasLoader();

type GLTextAtlasStatus = {
  status: "LOADING" | "LOADED";
  glTextAtlas?: TextAtlas;
};

export type WorldMarkerProps = {
  autoTextBackgroundColor: boolean;
  layerIndex?: number;
  markersByType: InteractiveMarkersByType;
  clearCachedMarkers: boolean;
  cameraDistance: number;
  diffModeEnabled: boolean;
};

// Average a list of color markers into a single output color value. The returned value is the
// mean RGB and max(alpha)
function averageMarkerColor(colorMarkers: ColorMarker[]): ReglColor {
  let count = 0;
  const sum = colorMarkers.reduce(
    (prev, cur) => {
      if (cur.color == undefined) {
        return prev;
      }
      prev[0] += cur.color.r;
      prev[1] += cur.color.g;
      prev[2] += cur.color.b;
      prev[3] = Math.max(prev[3], cur.color.a);
      ++count;
      return prev;
    },
    [0, 0, 0, 0] as ReglColor,
  );
  if (count <= 1) {
    return sum;
  }
  for (let i = 0; i < 3; i++) {
    sum[i] /= count;
  }
  return sum;
}

export default function WorldMarkers({
  autoTextBackgroundColor,
  layerIndex,
  markersByType,
  clearCachedMarkers,
}: WorldMarkerProps): JSX.Element {
  const getChildrenForHitmap = useMemo(() => createInstancedGetChildrenForHitmap(1), []);
  const {
    arrow,
    color,
    cube,
    cubeList,
    cylinder,
    glText,
    grid,
    instancedLineList,
    laserScan,
    linedConvexHull,
    lineList,
    lineStrip,
    mesh,
    pointcloud,
    points,
    poseMarker,
    sphere,
    sphereList,
    triangleList,
  } = markersByType;

  // GLTextAtlas download is shared among all instances of World, but we should only load the GLText command once we
  // have the pregenerated atlas available.
  const [glTextAtlasInfo, setGlTextAtlasInfo] = useState<GLTextAtlasStatus>({
    status: "LOADING",
    glTextAtlas: undefined,
  });
  useEffect(() => {
    let mounted = true;
    void glTextAtlasPromise.then((atlas) => {
      if (mounted) {
        setGlTextAtlasInfo({ status: "LOADED", glTextAtlas: atlas });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Group all line strips and line lists into as few markers as possible
  const groupedLines = groupLinesIntoInstancedLineLists([...lineList, ...lineStrip]);

  const backdropColor = useMemo((): ReglColor => averageMarkerColor(color), [color]);

  return (
    <>
      <Cover color={backdropColor} />
      <OccupancyGrids layerIndex={(layerIndex as number) + LAYER_INDEX_OCCUPANCY_GRIDS}>
        {grid}
      </OccupancyGrids>
      {/* Render PointClouds first so other markers with the same zIndex can show on top of PointClouds. */}
      <PointClouds layerIndex={layerIndex} clearCachedMarkers={clearCachedMarkers}>
        {pointcloud}
      </PointClouds>
      <Arrows layerIndex={layerIndex}>{arrow}</Arrows>
      <Points layerIndex={layerIndex} useWorldSpaceSize>
        {points}
      </Points>
      <Triangles layerIndex={layerIndex}>{triangleList}</Triangles>
      <Spheres layerIndex={layerIndex}>{[...sphere, ...sphereList]}</Spheres>
      <Cylinders layerIndex={layerIndex}>{cylinder}</Cylinders>
      <Cubes layerIndex={layerIndex}>{[...cube, ...cubeList]}</Cubes>
      <PoseMarkers layerIndex={layerIndex} markers={poseMarker} />
      <LaserScans layerIndex={layerIndex}>{laserScan}</LaserScans>
      {glTextAtlasInfo.status === "LOADED" && (
        <GLText
          layerIndex={(layerIndex as number) + LAYER_INDEX_TEXT}
          alphabet={ALPHABET}
          scaleInvariantFontSize={14}
          autoBackgroundColor={autoTextBackgroundColor}
          textAtlas={glTextAtlasInfo.glTextAtlas}
        >
          {glText}
        </GLText>
      )}
      <Lines getChildrenForHitmap={getChildrenForHitmap} layerIndex={layerIndex}>
        {[...instancedLineList, ...groupedLines]}
      </Lines>
      <LinedConvexHulls layerIndex={layerIndex}>{linedConvexHull}</LinedConvexHulls>
      <MeshMarkers layerIndex={layerIndex} markers={mesh}></MeshMarkers>
    </>
  );
}
