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

import CubeOutline from "@mdi/svg/svg/cube-outline.svg";
import { clamp } from "lodash";
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
  FilledPolygons,
  createInstancedGetChildrenForHitmap,
  Overlay,
} from "regl-worldview";
import styled from "styled-components";

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
  OverlayIconMarker,
  ColorMarker,
} from "@foxglove/studio-base/types/Messages";
import { ReglColor } from "@foxglove/studio-base/util/colorUtils";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import glTextAtlasLoader, { TextAtlas } from "./utils/glTextAtlasLoader";
import { groupLinesIntoInstancedLineLists } from "./utils/groupingUtils";

const ICON_WRAPPER_SIZE = 24;
const ICON_SIZE = 14;

export const SIconWrapper = styled.div`
  position: absolute;
  color: ${colors.LIGHT};
  box-shadow: 0px 0px 12px rgba(23, 34, 40, 0.7);
  overflow: hidden;
  pointer-events: none;
  top: 0;
  left: 0;
`;
export type MarkerWithInteractionData = Interactive<BaseMarker>;

export type InteractiveMarkersByType = {
  arrow: MarkerWithInteractionData[];
  color: Interactive<ColorMarker>[];
  cube: Interactive<CubeMarker>[];
  cubeList: Interactive<CubeListMarker>[];
  cylinder: Interactive<CylinderMarker>[];
  filledPolygon: Interactive<SphereMarker>[];
  glText: Interactive<GLTextMarker>[];
  grid: Interactive<BaseMarker>[];
  instancedLineList: Interactive<BaseMarker>[];
  laserScan: Interactive<BaseMarker>[];
  linedConvexHull: Interactive<LineListMarker | LineStripMarker>[];
  lineList: Interactive<LineListMarker>[];
  lineStrip: Interactive<LineStripMarker>[];
  overlayIcon: Interactive<OverlayIconMarker>[];
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

const MIN_SCALE = 0.6;
const MIN_DISTANCE = 50;
const MAX_DISTANCE = 100;

// The icons will scale according to camera distance between MIN_DISTANCE and MAX_DISTANCE, from 100% to MIN_SCALE.
function getIconScaleByCameraDistance(distance: number): number {
  const effectiveIconDistance = clamp(distance, MIN_DISTANCE, MAX_DISTANCE);
  return (
    1 - ((effectiveIconDistance - MIN_DISTANCE) * (1 - MIN_SCALE)) / (MAX_DISTANCE - MIN_DISTANCE)
  );
}

function getIconStyles(distance: number): {
  iconWrapperStyles: {
    [attr: string]: string | number;
  };
  scaledIconSize: number;
  scaledIconWrapperSize: number;
} {
  const scale = getIconScaleByCameraDistance(distance);
  const scaledIconWrapperSize = Math.round(scale * ICON_WRAPPER_SIZE);
  const scaledIconSize = Math.round(scale * ICON_SIZE);
  const padding = Math.floor((scaledIconWrapperSize - scaledIconSize) / 2);
  return {
    iconWrapperStyles: {
      padding,
      width: scaledIconWrapperSize,
      height: scaledIconWrapperSize,
      borderRadius: scaledIconWrapperSize,
    },
    scaledIconSize,
    scaledIconWrapperSize,
  };
}

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
  cameraDistance,
}: WorldMarkerProps): JSX.Element {
  const getChildrenForHitmap = useMemo(() => createInstancedGetChildrenForHitmap(1), []);
  const {
    arrow,
    color,
    cube,
    cubeList,
    cylinder,
    filledPolygon,
    glText,
    grid,
    instancedLineList,
    laserScan,
    linedConvexHull,
    lineList,
    lineStrip,
    overlayIcon,
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

  // Render smaller icons when camera is zoomed out.
  const { iconWrapperStyles, scaledIconWrapperSize, scaledIconSize } = useMemo(
    () => getIconStyles(cameraDistance),
    [cameraDistance],
  );

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
      <FilledPolygons layerIndex={layerIndex}>{filledPolygon}</FilledPolygons>
      <Lines getChildrenForHitmap={getChildrenForHitmap} layerIndex={layerIndex}>
        {[...instancedLineList, ...groupedLines]}
      </Lines>
      <LinedConvexHulls layerIndex={layerIndex}>{linedConvexHull}</LinedConvexHulls>
      <Overlay<Interactive<OverlayIconMarker>>
        renderItem={({ item, coordinates, index, dimension: { width, height } }) => {
          if (!coordinates) {
            return ReactNull;
          }
          const [left, top] = coordinates;
          if (left < -10 || top < -10 || left > width + 10 || top > height + 10) {
            return ReactNull; // Don't render anything that's too far outside of the canvas
          }
          const originalMsg = item.interactionData?.originalMessage ?? {};
          const parsedMsg = originalMsg;

          const metadata = parsedMsg?.metadata;
          if (metadata == undefined) {
            return;
          }
          const { markerStyle = {}, iconOffset: { x = 0, y = 0 } = {} } = metadata as {
            markerStyle?: React.CSSProperties;
            iconOffset?: { x: number; y: number };
          };

          return (
            <SIconWrapper
              key={index}
              style={{
                ...markerStyle,
                ...iconWrapperStyles,
                transform: `translate(${(left - scaledIconWrapperSize / 2 + x).toFixed()}px,${(
                  top -
                  scaledIconWrapperSize / 2 +
                  y
                ).toFixed()}px)`,
              }}
            >
              <CubeOutline fill="white" width={scaledIconSize} height={scaledIconSize} />
            </SIconWrapper>
          );
        }}
      >
        {overlayIcon}
      </Overlay>
    </>
  );
}
