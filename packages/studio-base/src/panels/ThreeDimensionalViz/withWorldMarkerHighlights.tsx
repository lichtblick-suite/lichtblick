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

import {
  InteractiveMarkersByType,
  WorldMarkerProps,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/WorldMarkers";
import Cover from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/Cover";
import {
  LAYER_INDEX_HIGHLIGHT_OVERLAY,
  LAYER_INDEX_HIGHLIGHT_BASE,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";

const withHighlights = (
  BaseWorldMarkers: ComponentType<WorldMarkerProps>,
): React.FC<WorldMarkerProps> => {
  const WorldMarkersWithHighlights = (props: WorldMarkerProps) => {
    const { markersByType } = props;

    // We only want to render the dim <Cover> overlay if there's at least one highlighted marker in the scene.
    let hasHighlightedMarkers = false;
    const highlightedMarkersByType: Partial<InteractiveMarkersByType> = {};
    const nonHighlightedMarkersByType: Partial<InteractiveMarkersByType> = {};

    // Partition the markersByType into two sets: highlighted and non-highlighted
    (Object.keys(markersByType) as (keyof InteractiveMarkersByType)[]).forEach((type) => {
      const [highlightedMarkers, nonHighlightedMarkers] = partition(
        markersByType[type],
        ({ interactionData }) => interactionData?.highlighted,
      );

      (highlightedMarkersByType as Record<string, unknown>)[type] = highlightedMarkers;
      (nonHighlightedMarkersByType as Record<string, unknown>)[type] = nonHighlightedMarkers;
      hasHighlightedMarkers = hasHighlightedMarkers || highlightedMarkers.length > 0;
    });

    return (
      <>
        <BaseWorldMarkers
          {...{
            ...props,
            markersByType: nonHighlightedMarkersByType as Required<
              typeof nonHighlightedMarkersByType
            >,
          }}
        />
        <Cover
          color={[0, 0, 0, hasHighlightedMarkers ? 0.6 : 0]}
          layerIndex={LAYER_INDEX_HIGHLIGHT_OVERLAY}
          overwriteDepthBuffer
        />
        <BaseWorldMarkers
          {...{
            ...props,
            layerIndex: LAYER_INDEX_HIGHLIGHT_BASE,
            markersByType: highlightedMarkersByType as Required<typeof highlightedMarkersByType>,
          }}
        />
      </>
    );
  };
  WorldMarkersWithHighlights.displayName = "WorldMarkersWithHighlights";
  return WorldMarkersWithHighlights;
};

export default withHighlights;
