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

import { WorldMarkerProps } from "@foxglove-studio/app/panels/ThreeDimensionalViz/WorldMarkers";
import Cover from "@foxglove-studio/app/panels/ThreeDimensionalViz/commands/Cover";
import {
  LAYER_INDEX_HIGHLIGHT_OVERLAY,
  LAYER_INDEX_HIGHLIGHT_BASE,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/constants";

const withHighlights = (
  BaseWorldMarkers: ComponentType<WorldMarkerProps>,
): React.FC<WorldMarkerProps> => {
  const WorldMarkersWithHighlights = (props: WorldMarkerProps) => {
    const { markersByType } = props;

    // We only want to render the dim <Cover> overlay if there's at least one highlighted marker in the scene.
    let hasHighlightedMarkers = false;
    const highlightedMarkersByType: any = {};
    const nonHighlightedMarkersByType: any = {};

    // Partition the markersByType into two sets: highlighted and non-highlighted
    Object.keys(markersByType).forEach((type) => {
      const [highlightedMarkers, nonHighlightedMarkers] = partition(
        (markersByType as any)[type],
        ({ interactionData }) => interactionData?.highlighted,
      );

      highlightedMarkersByType[type] = highlightedMarkers;
      nonHighlightedMarkersByType[type] = nonHighlightedMarkers;
      hasHighlightedMarkers = hasHighlightedMarkers || highlightedMarkers.length > 0;
    });

    return (
      <>
        <BaseWorldMarkers {...{ ...props, markersByType: nonHighlightedMarkersByType }} />
        <Cover
          color={[0, 0, 0, hasHighlightedMarkers ? 0.6 : 0]}
          layerIndex={LAYER_INDEX_HIGHLIGHT_OVERLAY}
          overwriteDepthBuffer
        />
        <BaseWorldMarkers
          {...{
            ...props,
            layerIndex: LAYER_INDEX_HIGHLIGHT_BASE,
            markersByType: highlightedMarkersByType,
          }}
        />
      </>
    );
  };
  WorldMarkersWithHighlights.displayName = "WorldMarkersWithHighlights";
  return WorldMarkersWithHighlights;
};

export default withHighlights;
