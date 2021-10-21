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

import { partition } from "lodash";
import { ComponentType } from "react";

import { vec4ToRGBA } from "@foxglove/regl-worldview";
import {
  InteractiveMarkersByType,
  WorldMarkerProps,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/WorldMarkers";
import { LAYER_INDEX_DIFF_MODE_BASE_PER_PASS } from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";

export const BASE_COLOR = [0.5, 0.5, 0.5, 1.0];
export const SOURCE_1_COLOR = [1, 0, 1, 1];
export const SOURCE_2_COLOR = [0, 1, 1, 1];

export const BASE_COLOR_RGBA = vec4ToRGBA(BASE_COLOR);
export const SOURCE_1_COLOR_RGBA = vec4ToRGBA(SOURCE_1_COLOR);
export const SOURCE_2_COLOR_RGBA = vec4ToRGBA(SOURCE_2_COLOR);

// Group markers into different collections in order to render them with different colors
// based on their source.
export function getDiffBySource(
  markers: InteractiveMarkersByType,
): [InteractiveMarkersByType, InteractiveMarkersByType, InteractiveMarkersByType] {
  const ret: [
    Partial<InteractiveMarkersByType>,
    Partial<InteractiveMarkersByType>,
    Partial<InteractiveMarkersByType>,
  ] = [{}, {}, {}];

  // Look for each marker type, spliting them into two sets if possible (one for each source)
  // Then, modify the markers so they're rendered based on their source.
  for (const key of Object.keys(markers) as (keyof InteractiveMarkersByType)[]) {
    const value = markers[key];
    const elems = Array.isArray(value) ? value : [value];
    const [source1, source2] = partition(elems, (m) => {
      const { interactionData } = m;
      return (
        interactionData == undefined || !interactionData.topic.startsWith(SECOND_SOURCE_PREFIX)
      );
    });

    // Format markers. This results in three render passes:
    // 1. Render Source 1 markers in red
    // 2. Render Source 2 markers in gray, disabling depth checking.
    // 3. Render Source 2 markers in green, with depth checking enabled (written in step 1).
    (ret[0] as Record<string, unknown>)[key] = source1.map((m) => ({
      ...m,
      colors: [],
      color: SOURCE_1_COLOR_RGBA,
      depth: {
        enable: true,
        mask: true,
      },
      blend: {
        enable: true,
        func: {
          src: "constant color",
          dst: "src alpha",
        },
        color: SOURCE_1_COLOR,
      },
    }));
    (ret[1] as Record<string, unknown>)[key] = source2.map((m) => ({
      ...m,
      colors: [],
      color: BASE_COLOR_RGBA,
      depth: {
        enable: false,
      },
      blend: {
        enable: true,
        func: {
          src: "constant color",
          dst: "zero",
        },
        color: BASE_COLOR,
      },
    }));
    (ret[2] as Record<string, unknown>)[key] = source2.map((m) => ({
      ...m,
      colors: [],
      color: SOURCE_2_COLOR_RGBA,
      depth: {
        enable: true,
      },
      blend: {
        enable: true,
        func: {
          src: "constant color",
          dst: "one",
        },
        color: SOURCE_2_COLOR,
      },
    }));
  }
  return ret as [InteractiveMarkersByType, InteractiveMarkersByType, InteractiveMarkersByType];
}

export const withDiffMode = (
  BaseWorldMarkers: ComponentType<WorldMarkerProps>,
): React.FC<WorldMarkerProps> => {
  const WorldMarkersWithDiffMode = (props: WorldMarkerProps) => {
    const { diffModeEnabled } = props;
    if (diffModeEnabled) {
      return (
        <>
          {getDiffBySource(props.markersByType).map((markersByRenderPass, i) => (
            <BaseWorldMarkers
              key={i}
              {...{
                ...props,
                clearCachedMarkers: true,
                layerIndex: (props.layerIndex as number) + i * LAYER_INDEX_DIFF_MODE_BASE_PER_PASS,
                markersByType: markersByRenderPass,
              }}
            />
          ))}
        </>
      );
    }
    return <BaseWorldMarkers {...props} />;
  };
  return WorldMarkersWithDiffMode;
};
